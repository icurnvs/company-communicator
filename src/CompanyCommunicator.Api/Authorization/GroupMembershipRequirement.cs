using Microsoft.AspNetCore.Authorization;

namespace CompanyCommunicator.Api.Authorization;

/// <summary>
/// Authorization requirement that demands the authenticated user be a member
/// of a specific Entra ID (Azure AD) group, verified via the <c>groups</c> claim.
/// </summary>
public sealed class GroupMembershipRequirement : IAuthorizationRequirement
{
    /// <summary>
    /// Initializes a new instance of <see cref="GroupMembershipRequirement"/>.
    /// </summary>
    /// <param name="groupId">The AAD group object ID that the user must belong to.</param>
    public GroupMembershipRequirement(string groupId)
    {
        GroupId = groupId;
    }

    /// <summary>Gets the required AAD group object ID.</summary>
    public string GroupId { get; }
}
