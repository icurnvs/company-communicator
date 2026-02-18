using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: updates the notification's total recipient count and transitions
/// its status from <c>SyncingRecipients</c> to <c>Sending</c>.
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
    /// Activity entry point. Updates the total recipient count and changes status to Sending.
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
        notification.Status = NotificationStatus.Sending;

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        _logger.LogInformation(
            "UpdateRecipientCountActivity: Notification {NotificationId} updated. " +
            "TotalRecipientCount={Count}, Status=Sending.",
            input.NotificationId, input.TotalRecipientCount);
    }
}
