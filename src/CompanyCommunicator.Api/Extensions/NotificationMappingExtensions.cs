using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Models;

namespace CompanyCommunicator.Api.Extensions;

/// <summary>
/// Extension methods that map <see cref="Notification"/> entity instances to DTO types.
/// Keeping mapping logic here keeps controllers thin and the mapping testable in isolation.
/// </summary>
internal static class NotificationMappingExtensions
{
    /// <summary>
    /// Maps a <see cref="Notification"/> entity to a full <see cref="NotificationDto"/>.
    /// The Audiences navigation collection must be loaded before calling this method.
    /// </summary>
    public static NotificationDto ToDto(this Notification entity)
    {
        var audiences = entity.Audiences
            .Select(a => new AudienceDto(a.AudienceType, a.AudienceId))
            .ToList()
            .AsReadOnly();

        return new NotificationDto(
            Id: entity.Id,
            Title: entity.Title,
            Summary: entity.Summary,
            ImageLink: entity.ImageLink,
            ImageBlobName: entity.ImageBlobName,
            ButtonTitle: entity.ButtonTitle,
            ButtonLink: entity.ButtonLink,
            Author: entity.Author,
            CreatedBy: entity.CreatedBy,
            CreatedDate: entity.CreatedDate,
            ScheduledDate: entity.ScheduledDate,
            SentDate: entity.SentDate,
            Status: entity.Status,
            AllUsers: entity.AllUsers,
            TotalRecipientCount: entity.TotalRecipientCount,
            SucceededCount: entity.SucceededCount,
            FailedCount: entity.FailedCount,
            RecipientNotFoundCount: entity.RecipientNotFoundCount,
            CanceledCount: entity.CanceledCount,
            UnknownCount: entity.UnknownCount,
            ErrorMessage: entity.ErrorMessage,
            Audiences: audiences);
    }

    /// <summary>
    /// Maps a <see cref="Notification"/> entity to a lightweight <see cref="NotificationSummaryDto"/>
    /// suitable for list views. No navigation collections are required.
    /// </summary>
    public static NotificationSummaryDto ToSummaryDto(this Notification entity)
        => new(
            Id: entity.Id,
            Title: entity.Title,
            Author: entity.Author,
            CreatedDate: entity.CreatedDate,
            ScheduledDate: entity.ScheduledDate,
            SentDate: entity.SentDate,
            Status: entity.Status,
            TotalRecipientCount: entity.TotalRecipientCount,
            SucceededCount: entity.SucceededCount,
            FailedCount: entity.FailedCount);

    /// <summary>
    /// Maps a <see cref="Notification"/> entity to a <see cref="DeliveryStatusDto"/>
    /// containing the aggregated delivery counts.
    /// </summary>
    public static DeliveryStatusDto ToDeliveryStatusDto(this Notification entity)
        => new(
            NotificationId: entity.Id,
            Status: entity.Status,
            TotalRecipientCount: entity.TotalRecipientCount,
            SucceededCount: entity.SucceededCount,
            FailedCount: entity.FailedCount,
            RecipientNotFoundCount: entity.RecipientNotFoundCount,
            CanceledCount: entity.CanceledCount,
            UnknownCount: entity.UnknownCount);
}
