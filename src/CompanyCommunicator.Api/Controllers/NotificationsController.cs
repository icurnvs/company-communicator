using CompanyCommunicator.Api.Authorization;
using CompanyCommunicator.Api.Extensions;
using CompanyCommunicator.Api.Validation;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Models;
using CompanyCommunicator.Core.Services.Blob;
using CompanyCommunicator.Core.Services.Bot;
using CompanyCommunicator.Core.Services.Cards;
using CompanyCommunicator.Core.Services.Queue;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CompanyCommunicator.Api.Controllers;

/// <summary>
/// REST API endpoints for managing and sending notifications.
/// </summary>
[ApiController]
[Route("api/notifications")]
[Authorize(Policy = PolicyNames.Author)]
[Produces("application/json")]
public sealed class NotificationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IServiceBusService _serviceBus;
    private readonly IAdaptiveCardService _cardService;
    private readonly IMessageSender _messageSender;

    /// <summary>
    /// Initializes a new instance of <see cref="NotificationsController"/>.
    /// </summary>
    public NotificationsController(
        AppDbContext db,
        IServiceBusService serviceBus,
        IAdaptiveCardService cardService,
        IMessageSender messageSender)
    {
        _db = db;
        _serviceBus = serviceBus;
        _cardService = cardService;
        _messageSender = messageSender;
    }

    // -------------------------------------------------------------------------
    // GET /api/notifications
    // -------------------------------------------------------------------------

    /// <summary>
    /// Lists notifications with optional filtering by status tab and pagination.
    /// </summary>
    /// <param name="status">
    /// Optional status filter: "draft", "sent" (includes Sending/Sent/Canceled/Failed), or "scheduled".
    /// </param>
    /// <param name="page">Page number (1-based). Defaults to 1.</param>
    /// <param name="pageSize">Items per page. Defaults to 25, maximum 100.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Array of <see cref="NotificationSummaryDto"/> ordered by CreatedDate descending.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<NotificationSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<NotificationSummaryDto>>> GetNotifications(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 25;
        if (pageSize > 100) pageSize = 100;

        var query = _db.Notifications.AsNoTracking();

        query = status?.ToLowerInvariant() switch
        {
            "draft" => query.Where(n => n.Status == NotificationStatus.Draft),
            "scheduled" => query.Where(n => n.Status == NotificationStatus.Scheduled),
            "sent" => query.Where(n =>
                n.Status == NotificationStatus.Sending ||
                n.Status == NotificationStatus.Sent ||
                n.Status == NotificationStatus.Canceled ||
                n.Status == NotificationStatus.Failed),
            _ => query,
        };

        var totalCount = await query.CountAsync(ct).ConfigureAwait(false);

        var notifications = await query
            .OrderByDescending(n => n.CreatedDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        Response.Headers["X-Total-Count"] = totalCount.ToString();

        var dtos = notifications.Select(n => n.ToSummaryDto()).ToList();
        return Ok(dtos);
    }

    // -------------------------------------------------------------------------
    // GET /api/notifications/{id}
    // -------------------------------------------------------------------------

    /// <summary>
    /// Gets the full detail of a single notification including its audiences.
    /// </summary>
    /// <param name="id">The notification GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns><see cref="NotificationDto"/> when found; 404 if not found.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(NotificationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NotificationDto>> GetNotification(
        Guid id,
        CancellationToken ct)
    {
        var notification = await _db.Notifications
            .AsNoTracking()
            .Include(n => n.Audiences)
            .FirstOrDefaultAsync(n => n.Id == id, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            return NotFound();
        }

        return Ok(notification.ToDto());
    }

    // -------------------------------------------------------------------------
    // POST /api/notifications
    // -------------------------------------------------------------------------

    /// <summary>
    /// Creates a new draft notification.
    /// </summary>
    /// <param name="request">The notification payload.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>201 Created with the new <see cref="NotificationDto"/> and Location header.</returns>
    [HttpPost]
    [EnableRateLimiting("write")]
    [ProducesResponseType(typeof(NotificationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<NotificationDto>> CreateNotification(
        [FromBody] CreateNotificationRequest request,
        CancellationToken ct)
    {
        var (isValid, errorMessage) = InputValidator.ValidateNotificationRequest(request);
        if (!isValid)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Validation failed",
                Detail = errorMessage,
                Status = StatusCodes.Status400BadRequest,
            });
        }

        var userIdentifier = GetUserIdentifier();

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Summary = request.Summary,
            ImageLink = request.ImageLink,
            ButtonTitle = request.ButtonTitle,
            ButtonLink = request.ButtonLink,
            AllUsers = request.AllUsers,
            Status = NotificationStatus.Draft,
            CreatedDate = DateTime.UtcNow,
            CreatedBy = userIdentifier,
            Author = userIdentifier,
        };

        if (request.Audiences is not null)
        {
            foreach (var audience in request.Audiences)
            {
                notification.Audiences.Add(new NotificationAudience
                {
                    AudienceType = audience.AudienceType,
                    AudienceId = audience.AudienceId,
                    NotificationId = notification.Id,
                });
            }
        }

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        var dto = notification.ToDto();
        return CreatedAtAction(nameof(GetNotification), new { id = notification.Id }, dto);
    }

    // -------------------------------------------------------------------------
    // PUT /api/notifications/{id}
    // -------------------------------------------------------------------------

    /// <summary>
    /// Updates an existing draft notification. Only Draft notifications may be updated.
    /// </summary>
    /// <param name="id">The notification GUID.</param>
    /// <param name="request">The updated notification payload.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Updated <see cref="NotificationDto"/>; 404 if not found; 409 if not Draft.</returns>
    [HttpPut("{id:guid}")]
    [EnableRateLimiting("write")]
    [ProducesResponseType(typeof(NotificationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<NotificationDto>> UpdateNotification(
        Guid id,
        [FromBody] UpdateNotificationRequest request,
        CancellationToken ct)
    {
        var (isValid, errorMessage) = InputValidator.ValidateNotificationRequest(request);
        if (!isValid)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Validation failed",
                Detail = errorMessage,
                Status = StatusCodes.Status400BadRequest,
            });
        }

        var notification = await _db.Notifications
            .Include(n => n.Audiences)
            .FirstOrDefaultAsync(n => n.Id == id, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            return NotFound();
        }

        if (notification.Status != NotificationStatus.Draft)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Conflict",
                Detail = $"Only Draft notifications can be updated. Current status: {notification.Status}.",
                Status = StatusCodes.Status409Conflict,
            });
        }

        // Update scalar fields
        notification.Title = request.Title;
        notification.Summary = request.Summary;
        notification.ImageLink = request.ImageLink;
        notification.ButtonTitle = request.ButtonTitle;
        notification.ButtonLink = request.ButtonLink;
        notification.AllUsers = request.AllUsers;

        // Replace audiences: remove old, insert new
        _db.NotificationAudiences.RemoveRange(notification.Audiences);
        notification.Audiences.Clear();

        if (request.Audiences is not null)
        {
            foreach (var audience in request.Audiences)
            {
                notification.Audiences.Add(new NotificationAudience
                {
                    AudienceType = audience.AudienceType,
                    AudienceId = audience.AudienceId,
                    NotificationId = notification.Id,
                });
            }
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        return Ok(notification.ToDto());
    }

    // -------------------------------------------------------------------------
    // DELETE /api/notifications/{id}
    // -------------------------------------------------------------------------

    /// <summary>
    /// Deletes a draft notification. Admin only. Only Draft notifications may be deleted.
    /// </summary>
    /// <param name="id">The notification GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>204 No Content; 404 if not found; 409 if not Draft.</returns>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PolicyNames.Admin)]
    [EnableRateLimiting("write")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteNotification(
        Guid id,
        CancellationToken ct)
    {
        var notification = await _db.Notifications
            .Include(n => n.Audiences)
            .FirstOrDefaultAsync(n => n.Id == id, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            return NotFound();
        }

        if (notification.Status != NotificationStatus.Draft)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Conflict",
                Detail = $"Only Draft notifications can be deleted. Current status: {notification.Status}.",
                Status = StatusCodes.Status409Conflict,
            });
        }

        _db.Notifications.Remove(notification);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        return NoContent();
    }

    // -------------------------------------------------------------------------
    // POST /api/notifications/{id}/send
    // -------------------------------------------------------------------------

    /// <summary>
    /// Queues a draft notification for immediate delivery.
    /// </summary>
    /// <param name="id">The notification GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>202 Accepted; 404 if not found; 409 if not Draft.</returns>
    [HttpPost("{id:guid}/send")]
    [EnableRateLimiting("write")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SendNotification(
        Guid id,
        CancellationToken ct)
    {
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == id, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            return NotFound();
        }

        if (notification.Status != NotificationStatus.Draft)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Conflict",
                Detail = $"Only Draft notifications can be sent. Current status: {notification.Status}.",
                Status = StatusCodes.Status409Conflict,
            });
        }

        notification.Status = NotificationStatus.Queued;
        notification.SentDate = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        await _serviceBus.SendPrepareMessageAsync(notification.Id, ct).ConfigureAwait(false);

        return Accepted();
    }

    // -------------------------------------------------------------------------
    // POST /api/notifications/{id}/schedule
    // -------------------------------------------------------------------------

    /// <summary>
    /// Schedules a draft notification to be sent at a future date.
    /// </summary>
    /// <param name="id">The notification GUID.</param>
    /// <param name="request">The schedule request containing the target date.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Updated <see cref="NotificationDto"/>; 400 if date invalid; 404 if not found; 409 if not Draft.</returns>
    [HttpPost("{id:guid}/schedule")]
    [EnableRateLimiting("write")]
    [ProducesResponseType(typeof(NotificationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<NotificationDto>> ScheduleNotification(
        Guid id,
        [FromBody] ScheduleNotificationRequest request,
        CancellationToken ct)
    {
        var minScheduledDate = DateTime.UtcNow.AddMinutes(5);
        if (request.ScheduledDate.ToUniversalTime() < minScheduledDate)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Validation failed",
                Detail = "ScheduledDate must be at least 5 minutes in the future.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        var notification = await _db.Notifications
            .Include(n => n.Audiences)
            .FirstOrDefaultAsync(n => n.Id == id, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            return NotFound();
        }

        if (notification.Status != NotificationStatus.Draft)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Conflict",
                Detail = $"Only Draft notifications can be scheduled. Current status: {notification.Status}.",
                Status = StatusCodes.Status409Conflict,
            });
        }

        notification.Status = NotificationStatus.Scheduled;
        notification.ScheduledDate = request.ScheduledDate.ToUniversalTime();
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        return Ok(notification.ToDto());
    }

    // -------------------------------------------------------------------------
    // POST /api/notifications/{id}/cancel
    // -------------------------------------------------------------------------

    /// <summary>
    /// Cancels a scheduled or in-progress notification.
    /// </summary>
    /// <param name="id">The notification GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Updated <see cref="NotificationDto"/>; 404 if not found; 409 if not cancelable.</returns>
    [HttpPost("{id:guid}/cancel")]
    [EnableRateLimiting("write")]
    [ProducesResponseType(typeof(NotificationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<NotificationDto>> CancelNotification(
        Guid id,
        CancellationToken ct)
    {
        var notification = await _db.Notifications
            .Include(n => n.Audiences)
            .FirstOrDefaultAsync(n => n.Id == id, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            return NotFound();
        }

        var cancelableStatuses = new[]
        {
            NotificationStatus.Scheduled,
            NotificationStatus.Queued,
            NotificationStatus.SyncingRecipients,
            NotificationStatus.InstallingApp,
            NotificationStatus.Sending,
        };

        if (!cancelableStatuses.Contains(notification.Status))
        {
            return Conflict(new ProblemDetails
            {
                Title = "Conflict",
                Detail = $"Notification with status '{notification.Status}' cannot be canceled.",
                Status = StatusCodes.Status409Conflict,
            });
        }

        notification.Status = NotificationStatus.Canceled;
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        return Ok(notification.ToDto());
    }

    // -------------------------------------------------------------------------
    // GET /api/notifications/{id}/status
    // -------------------------------------------------------------------------

    /// <summary>
    /// Gets the aggregated delivery status counts for a notification.
    /// </summary>
    /// <param name="id">The notification GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns><see cref="DeliveryStatusDto"/>; 404 if not found.</returns>
    [HttpGet("{id:guid}/status")]
    [ProducesResponseType(typeof(DeliveryStatusDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DeliveryStatusDto>> GetDeliveryStatus(
        Guid id,
        CancellationToken ct)
    {
        var notification = await _db.Notifications
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == id, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            return NotFound();
        }

        return Ok(notification.ToDeliveryStatusDto());
    }

    // -------------------------------------------------------------------------
    // POST /api/notifications/{id}/preview
    // -------------------------------------------------------------------------

    /// <summary>
    /// Sends a preview of the notification card to the calling user via the bot.
    /// Requires the calling user to have the bot installed (ConversationId in Users table).
    /// </summary>
    /// <param name="id">The notification GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>200 OK if sent; 404 if notification not found; 424 if bot not installed for user.</returns>
    [HttpPost("{id:guid}/preview")]
    [EnableRateLimiting("write")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status424FailedDependency)]
    public async Task<IActionResult> SendPreview(
        Guid id,
        CancellationToken ct)
    {
        var notification = await _db.Notifications
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == id, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            return NotFound();
        }

        // Resolve the calling user's AAD OID from claims
        var callerOid = User.FindFirst("oid")?.Value
            ?? User.FindFirst("http://schemas.microsoft.com/identity/claims/objectidentifier")?.Value;

        if (string.IsNullOrEmpty(callerOid))
        {
            return Unauthorized();
        }

        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.AadId == callerOid, ct)
            .ConfigureAwait(false);

        if (user is null || string.IsNullOrEmpty(user.ConversationId) || string.IsNullOrEmpty(user.ServiceUrl))
        {
            return StatusCode(StatusCodes.Status424FailedDependency, new ProblemDetails
            {
                Title = "Failed Dependency",
                Detail = "Cannot send preview: the bot is not installed for your account. " +
                         "Install the Company Communicator app in Teams first.",
                Status = StatusCodes.Status424FailedDependency,
            });
        }

        var cardJson = _cardService.BuildNotificationCard(notification);
        await _messageSender.SendNotificationAsync(
            user.ConversationId,
            user.ServiceUrl,
            cardJson,
            ct).ConfigureAwait(false);

        return Ok();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private string GetUserIdentifier()
    {
        // Prefer preferred_username (UPN), fall back to name claim, then OID
        return User.FindFirst("preferred_username")?.Value
            ?? User.FindFirst("name")?.Value
            ?? User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name")?.Value
            ?? User.FindFirst("oid")?.Value
            ?? User.Identity?.Name
            ?? "unknown";
    }
}
