using CompanyCommunicator.Core.Data.Entities;

namespace CompanyCommunicator.Core.Services.Graph;

/// <summary>
/// Abstraction for Microsoft Graph API operations used by Company Communicator.
/// All returned <see cref="User"/> instances are mapped from Graph User objects
/// and represent <see cref="CompanyCommunicator.Core.Data.Entities.User"/> entities.
/// </summary>
public interface IGraphService
{
    /// <summary>
    /// Gets all users in the tenant using full enumeration (no delta tracking).
    /// Primarily used for initial sync scenarios.
    /// </summary>
    /// <param name="deltaLink">Unused for full enumeration; reserved for future use.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Read-only list of mapped User entities.</returns>
    Task<IReadOnlyList<User>> GetAllUsersAsync(string? deltaLink, CancellationToken ct);

    /// <summary>
    /// Gets users using Graph delta query to retrieve only changes since the last sync.
    /// </summary>
    /// <param name="deltaLink">
    /// The delta link from the previous call. Pass <c>null</c> to start a fresh delta cycle.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A tuple of the changed users and the new delta link to use on the next call.
    /// </returns>
    Task<(IReadOnlyList<User> Users, string? NewDeltaLink)> GetAllUsersDeltaAsync(string? deltaLink, CancellationToken ct);

    /// <summary>
    /// Gets the direct members of a Teams team channel.
    /// </summary>
    /// <param name="teamId">The Teams team ID (AAD group ID).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Read-only list of mapped User entities.</returns>
    Task<IReadOnlyList<User>> GetTeamMembersAsync(string teamId, CancellationToken ct);

    /// <summary>
    /// Gets the members of an AAD group.
    /// </summary>
    /// <param name="groupId">The AAD group object ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Read-only list of mapped User entities.</returns>
    Task<IReadOnlyList<User>> GetGroupMembersAsync(string groupId, CancellationToken ct);

    /// <summary>
    /// Downloads a user's profile photo and returns it as a base-64 encoded string.
    /// Returns an empty string if no photo is available.
    /// </summary>
    /// <param name="userId">The AAD user object ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Base-64 encoded JPEG/PNG, or empty string if not available.</returns>
    Task<string> GetUserPhotoBase64Async(string userId, CancellationToken ct);

    /// <summary>
    /// Searches Entra ID (AAD) groups whose display name starts with the specified query string.
    /// Returns up to 25 results.
    /// </summary>
    /// <param name="query">The prefix string to search for in group display names.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A read-only list of tuples containing the group object ID and display name.
    /// </returns>
    Task<IReadOnlyList<(string Id, string DisplayName)>> SearchGroupsAsync(string query, CancellationToken ct);
}
