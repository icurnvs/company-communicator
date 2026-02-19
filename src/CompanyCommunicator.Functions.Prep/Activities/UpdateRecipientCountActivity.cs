using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: updates the notification's total recipient count.
/// Status transition to Sending is handled by PrepareToSendOrchestrator
/// after the proactive install step completes.
/// </summary>
public sealed class UpdateRecipientCountActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<UpdateRecipientCountActivity> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="UpdateRecipientCountActivity"/>.
    /// </summary>
    public UpdateRecipientCountActivity(
        AppDbContext db,
        ILogger<UpdateRecipientCountActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Activity entry point. Updates the total recipient count only.
    /// </summary>
    /// <param name="input">Contains the notification ID and the final recipient count.</param>
    /// <param name="ctx">Function execution context.</param>
    [Function(nameof(UpdateRecipientCountActivity))]
    public async Task RunActivity(
        [ActivityTrigger] UpdateCountInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == input.NotificationId, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            _logger.LogError(
                "UpdateRecipientCountActivity: Notification {NotificationId} not found.",
                input.NotificationId);
            throw new InvalidOperationException(
                $"Notification {input.NotificationId} not found.");
        }

        notification.TotalRecipientCount = input.TotalRecipientCount;
        // Status transition to Sending is now handled by PrepareToSendOrchestrator
        // after the install step completes.

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        _logger.LogInformation(
            "UpdateRecipientCountActivity: Notification {NotificationId} TotalRecipientCount={Count}.",
            input.NotificationId, input.TotalRecipientCount);
    }
}
