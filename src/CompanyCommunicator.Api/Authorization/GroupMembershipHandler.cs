using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Api.Authorization;

/// <summary>
/// Handles <see cref="GroupMembershipRequirement"/> by checking whether the
/// authenticated user's JWT contains a <c>groups</c> claim that includes the
/// required AAD group object ID.
/// </summary>
internal sealed class GroupMembershipHandler
    : AuthorizationHandler<GroupMembershipRequirement>
{
    private readonly ILogger<GroupMembershipHandler> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="GroupMembershipHandler"/>.
    /// </summary>
    /// <param name="logger">Logger.</param>
    public GroupMembershipHandler(ILogger<GroupMembershipHandler> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc/>
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        GroupMembershipRequirement requirement)
    {
        // The groups claim contains the AAD group object IDs the user belongs to.
        // With overage (many groups), the claim may be absent; in that case a
        // downstream call to Microsoft Graph would be needed -- marked VERIFY.
        var groupClaims = context.User.FindAll("groups")
            .Concat(context.User.FindAll("http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"))
            .Select(c => c.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (groupClaims.Contains(requirement.GroupId))
        {
            _logger.LogDebug(
                "User {User} is a member of required group {GroupId}.",
                context.User.Identity?.Name, requirement.GroupId);
            context.Succeed(requirement);
        }
        else
        {
            _logger.LogDebug(
                "User {User} is NOT a member of required group {GroupId}.",
                context.User.Identity?.Name, requirement.GroupId);
        }

        return Task.CompletedTask;
    }
}
