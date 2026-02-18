namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Request body for scheduling a notification to be sent at a future date.
/// </summary>
public sealed record ScheduleNotificationRequest(DateTime ScheduledDate);
