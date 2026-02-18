using System.Net;
using System.Text.Json;
using Azure.Messaging.ServiceBus;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Models;
using CompanyCommunicator.Core.Services.Blob;
using CompanyCommunicator.Core.Services.Bot;
using CompanyCommunicator.Core.Services.Queue;
using CompanyCommunicator.Functions.Send.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Send;

/// <summary>
/// Azure Function triggered by the <c>cc-send</c> Service Bus queue.
/// Delivers a single Adaptive Card notification to one Teams recipient.
/// </summary>
/// <remarks>
/// Runs on a Consumption plan; many instances may execute in parallel.
/// All shared mutable state (throttle, card cache) is managed via
/// <see cref="ThrottleManager"/> which handles optimistic concurrency internally.
/// </remarks>
public sealed class SendMessageFunction
{
    // Maximum delivery attempts before permanently marking a message as Failed.
    private const int MaxRetryCount = 10;

    // Default retry-after duration when the 429 response carries no Retry-After header.
    private static readonly TimeSpan DefaultThrottleDelay = TimeSpan.FromSeconds(30);

    private readonly AppDbContext _db;
    private readonly IMessageSender _messageSender;
    private readonly IBlobStorageService _blobService;
    private readonly ThrottleManager _throttleManager;
    private readonly ServiceBusSender _sendSender;

    /// <summary>
    /// Initializes a new instance of <see cref="SendMessageFunction"/>.
    /// </summary>
    public SendMessageFunction(
        AppDbContext db,
        IMessageSender messageSender,
        IBlobStorageService blobService,
        ThrottleManager throttleManager,
        IServiceBusSenderFactory senderFactory)
    {
        _db = db;
        _messageSender = messageSender;
        _blobService = blobService;
        _throttleManager = throttleManager;
        _sendSender = senderFactory.GetSender(QueueNames.Send);
    }

    /// <summary>
    /// Function entry point. Processes one <see cref="SendQueueMessage"/> per invocation.
    /// </summary>
    /// <param name="messageBody">JSON-serialized <see cref="SendQueueMessage"/>.</param>
    /// <param name="executionContext">Function execution context (used to obtain the logger).</param>
    [Function(nameof(SendMessageFunction))]
    public async Task Run(
        [ServiceBusTrigger(
            QueueNames.Send,
            Connection = "ServiceBus")]
        string messageBody,
        FunctionContext executionContext)
    {
        var logger = executionContext.GetLogger<SendMessageFunction>();
        var ct = executionContext.CancellationToken;

        // ------------------------------------------------------------------
        // 1. Deserialize message
        // ------------------------------------------------------------------
        SendQueueMessage? message;
        try
        {
            message = JsonSerializer.Deserialize<SendQueueMessage>(messageBody);
        }
        catch (JsonException ex)
        {
            logger.LogError(ex,
                "Failed to deserialize SendQueueMessage. Message will be dead-lettered.");
            // Do NOT throw -- an undeserializable message is a poison message and
            // should be dead-lettered rather than retried.
            return;
        }

        if (message is null)
        {
            logger.LogError(
                "Deserialized SendQueueMessage is null. Message will be dead-lettered.");
            return;
        }

        logger.LogInformation(
            "Processing send message for SentNotification {SentNotificationId} " +
            "(Notification {NotificationId}, Recipient {RecipientId}).",
            message.SentNotificationId, message.NotificationId, message.RecipientId);

        // ------------------------------------------------------------------
        // 2. Load the SentNotification record (needed for RetryCount and status updates)
        // ------------------------------------------------------------------
        var sentNotification = await _db.SentNotifications
            .FindAsync(new object[] { message.SentNotificationId }, ct)
            .ConfigureAwait(false);

        if (sentNotification is null)
        {
            logger.LogWarning(
                "SentNotification {SentNotificationId} not found in database. Skipping.",
                message.SentNotificationId);
            return;
        }

        // ------------------------------------------------------------------
        // 3. Pre-flight: is the parent notification canceled?
        // ------------------------------------------------------------------
        var notification = await _db.Notifications
            .FindAsync(new object[] { message.NotificationId }, ct)
            .ConfigureAwait(false);

        if (notification?.Status == NotificationStatus.Canceled)
        {
            logger.LogInformation(
                "Notification {NotificationId} has been canceled. " +
                "Marking SentNotification {SentNotificationId} as Canceled.",
                message.NotificationId, message.SentNotificationId);

            await UpdateDeliveryStatusAsync(
                sentNotification,
                DeliveryStatus.Failed,   // Use Failed for canceled deliveries
                statusCode: null,
                errorMessage: "Notification was canceled before delivery.",
                ct).ConfigureAwait(false);

            return;
        }

        // ------------------------------------------------------------------
        // 4. Pre-flight: is sending currently throttled?
        // ------------------------------------------------------------------
        var (isThrottled, retryAfterUtc) = await _throttleManager
            .IsThrottledAsync(ct)
            .ConfigureAwait(false);

        if (isThrottled)
        {
            logger.LogWarning(
                "Send pipeline is throttled until {RetryAfterUtc:O}. " +
                "Re-queuing SentNotification {SentNotificationId} with scheduled delay.",
                retryAfterUtc, message.SentNotificationId);

            await RequeueWithDelayAsync(messageBody, retryAfterUtc!.Value, ct)
                .ConfigureAwait(false);
            return;
        }

        // ------------------------------------------------------------------
        // 5. Pre-flight: does the recipient have a conversation?
        // ------------------------------------------------------------------
        if (string.IsNullOrEmpty(message.ConversationId))
        {
            logger.LogWarning(
                "SentNotification {SentNotificationId}: recipient {RecipientId} has no ConversationId " +
                "(bot not installed). Marking as RecipientNotFound.",
                message.SentNotificationId, message.RecipientId);

            await UpdateDeliveryStatusAsync(
                sentNotification,
                DeliveryStatus.RecipientNotFound,
                statusCode: null,
                errorMessage: "Bot is not installed for this recipient.",
                ct).ConfigureAwait(false);

            return;
        }

        // ------------------------------------------------------------------
        // 6. Get the Adaptive Card JSON (static cache -> blob fallback)
        // ------------------------------------------------------------------
        var cardJson = await _throttleManager
            .GetCardJsonAsync(message.NotificationId, _blobService, ct)
            .ConfigureAwait(false);

        if (cardJson is null)
        {
            logger.LogError(
                "Adaptive Card blob not found for notification {NotificationId}. " +
                "Marking SentNotification {SentNotificationId} as Failed.",
                message.NotificationId, message.SentNotificationId);

            await UpdateDeliveryStatusAsync(
                sentNotification,
                DeliveryStatus.Failed,
                statusCode: null,
                errorMessage: "Adaptive Card blob not found.",
                ct).ConfigureAwait(false);

            return;
        }

        // ------------------------------------------------------------------
        // 7. Send the notification
        // ------------------------------------------------------------------
        try
        {
            await _messageSender
                .SendNotificationAsync(
                    message.ConversationId,
                    message.ServiceUrl ?? string.Empty,
                    cardJson,
                    ct)
                .ConfigureAwait(false);

            // Success -- update delivery record.
            sentNotification.DeliveryStatus = DeliveryStatus.Succeeded;
            sentNotification.SentDate = DateTime.UtcNow;
            sentNotification.StatusCode = (int)HttpStatusCode.OK;
            sentNotification.ErrorMessage = null;

            await _db.SaveChangesAsync(ct).ConfigureAwait(false);

            logger.LogInformation(
                "Successfully delivered SentNotification {SentNotificationId} " +
                "to conversation {ConversationId}.",
                message.SentNotificationId, message.ConversationId);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.TooManyRequests)
        {
            // ------------------------------------------------------------------
            // 7a. 429 Too Many Requests -- record throttle, re-queue with delay
            // ------------------------------------------------------------------
            var retryAfter = ParseRetryAfter(ex.Message);

            logger.LogWarning(
                "429 Too Many Requests received for SentNotification {SentNotificationId}. " +
                "Throttle duration: {RetryAfter}. Recording throttle state and re-queuing.",
                message.SentNotificationId, retryAfter);

            await _throttleManager
                .RecordThrottleAsync(retryAfter, ct)
                .ConfigureAwait(false);

            // Mark as Retrying so the dashboard reflects current state.
            sentNotification.DeliveryStatus = DeliveryStatus.Retrying;
            sentNotification.StatusCode = (int)HttpStatusCode.TooManyRequests;
            sentNotification.RetryCount++;
            await _db.SaveChangesAsync(ct).ConfigureAwait(false);

            // Re-queue with scheduled delay (avoids tight spin loops).
            var scheduledEnqueue = DateTime.UtcNow.Add(retryAfter);
            await RequeueWithDelayAsync(messageBody, scheduledEnqueue, ct)
                .ConfigureAwait(false);
        }
        catch (HttpRequestException ex) when (
            ex.StatusCode == HttpStatusCode.NotFound ||
            ex.StatusCode == HttpStatusCode.Forbidden)
        {
            // ------------------------------------------------------------------
            // 7b. 404/403 -- recipient removed bot or left the tenant
            // ------------------------------------------------------------------
            logger.LogWarning(
                "HTTP {StatusCode} for SentNotification {SentNotificationId}: recipient not reachable. " +
                "Marking as RecipientNotFound.",
                ex.StatusCode, message.SentNotificationId);

            await UpdateDeliveryStatusAsync(
                sentNotification,
                DeliveryStatus.RecipientNotFound,
                statusCode: (int?)ex.StatusCode,
                errorMessage: ex.Message,
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            // ------------------------------------------------------------------
            // 7c. Unexpected error -- increment retry counter, fail if exhausted
            // ------------------------------------------------------------------
            sentNotification.RetryCount++;

            if (sentNotification.RetryCount >= MaxRetryCount)
            {
                logger.LogError(ex,
                    "SentNotification {SentNotificationId} exceeded max retries ({MaxRetry}). " +
                    "Marking as Failed.",
                    message.SentNotificationId, MaxRetryCount);

                await UpdateDeliveryStatusAsync(
                    sentNotification,
                    DeliveryStatus.Failed,
                    statusCode: null,
                    errorMessage: TruncateMessage(ex.Message),
                    ct).ConfigureAwait(false);

                // Do NOT re-throw -- message has been permanently failed; no further retries.
            }
            else
            {
                logger.LogWarning(ex,
                    "Transient error for SentNotification {SentNotificationId} " +
                    "(attempt {RetryCount}/{MaxRetry}). Re-throwing for Service Bus retry.",
                    message.SentNotificationId, sentNotification.RetryCount, MaxRetryCount);

                sentNotification.DeliveryStatus = DeliveryStatus.Retrying;
                sentNotification.ErrorMessage = TruncateMessage(ex.Message);
                await _db.SaveChangesAsync(ct).ConfigureAwait(false);

                // Re-throw so the Service Bus SDK will abandon the message
                // and it will be retried according to the queue's retry policy.
                throw;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private async Task UpdateDeliveryStatusAsync(
        SentNotification sentNotification,
        string status,
        int? statusCode,
        string? errorMessage,
        CancellationToken ct)
    {
        sentNotification.DeliveryStatus = status;
        sentNotification.StatusCode = statusCode;
        sentNotification.ErrorMessage = TruncateMessage(errorMessage);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    /// <summary>
    /// Re-queues the original message body to the <c>cc-send</c> queue with a scheduled
    /// enqueue time so it will not be visible until after the throttle window expires.
    /// </summary>
    private async Task RequeueWithDelayAsync(
        string messageBody,
        DateTime scheduledEnqueueTimeUtc,
        CancellationToken ct)
    {
        var msg = new ServiceBusMessage(messageBody)
        {
            ContentType = "application/json",
            ScheduledEnqueueTime = scheduledEnqueueTimeUtc,
        };

        await _sendSender.SendMessageAsync(msg, ct).ConfigureAwait(false);
    }

    /// <summary>
    /// Attempts to extract a Retry-After duration from the exception message text.
    /// Falls back to <see cref="DefaultThrottleDelay"/> when no value is found.
    /// The Bot Framework REST API includes the delay in the body text, not a header,
    /// so we do a best-effort parse of the embedded seconds value.
    /// </summary>
    private static TimeSpan ParseRetryAfter(string exceptionMessage)
    {
        // Look for patterns like "Retry-After: 30" or "retry-after\":30" in the body.
        const string pattern = "retry-after";
        var lower = exceptionMessage.ToLowerInvariant();
        var idx = lower.IndexOf(pattern, StringComparison.Ordinal);

        if (idx >= 0)
        {
            // Find the next sequence of digits after the header name.
            var startDigit = idx + pattern.Length;
            while (startDigit < lower.Length && !char.IsDigit(lower[startDigit]))
                startDigit++;

            var endDigit = startDigit;
            while (endDigit < lower.Length && char.IsDigit(lower[endDigit]))
                endDigit++;

            if (endDigit > startDigit &&
                int.TryParse(lower.AsSpan(startDigit, endDigit - startDigit), out var seconds))
            {
                return TimeSpan.FromSeconds(seconds);
            }
        }

        return DefaultThrottleDelay;
    }

    /// <summary>
    /// Ensures error messages stored in the DB do not exceed the column length limit (1000 chars).
    /// </summary>
    private static string? TruncateMessage(string? message) =>
        message is null ? null
            : message.Length <= 1000 ? message
            : message[..997] + "...";
}
