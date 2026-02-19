using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class GetInstallBatchActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<GetInstallBatchActivity> _logger;

    public GetInstallBatchActivity(AppDbContext db, ILogger<GetInstallBatchActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function(nameof(GetInstallBatchActivity))]
    public async Task<GetInstallBatchResult> RunActivity(
        [ActivityTrigger] GetInstallBatchInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;
        var totalSize = input.PageSize * input.PageCount;

        var rows = await _db.SentNotifications
            .Where(s => s.Id > input.LastSeenId
                        && s.NotificationId == input.NotificationId
                        && s.ConversationId == null
                        && s.RecipientType == "User"
                        && s.DeliveryStatus == DeliveryStatus.Queued)
            .OrderBy(s => s.Id)
            .Select(s => new { s.Id, s.RecipientId })
            .Take(totalSize + 1)
            .AsNoTracking()
            .ToListAsync(ct)
            .ConfigureAwait(false);

        bool hasMore = rows.Count > totalSize;
        if (hasMore) rows.RemoveAt(rows.Count - 1);

        var pages = rows
            .Select((r, i) => (r, i))
            .GroupBy(x => x.i / input.PageSize)
            .Select(g => (IReadOnlyList<string>)g.Select(x => x.r.RecipientId).ToList())
            .ToList();

        long nextCursor = rows.Count > 0 ? rows[^1].Id : input.LastSeenId;

        _logger.LogDebug(
            "GetInstallBatchActivity: Notification {NotificationId} — " +
            "{Pages} page(s), {Total} users, cursor {From}->{To}, HasMore={HasMore}.",
            input.NotificationId, pages.Count, rows.Count,
            input.LastSeenId, nextCursor, hasMore);

        return new GetInstallBatchResult(pages, nextCursor, hasMore);
    }
}
