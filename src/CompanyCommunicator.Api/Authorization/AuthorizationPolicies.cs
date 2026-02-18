using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CompanyCommunicator.Api.Authorization;

/// <summary>
/// Well-known authorization policy names for Company Communicator.
/// </summary>
public static class PolicyNames
{
    /// <summary>Policy for users who can author and send notifications.</summary>
    public const string Author = "AuthorPolicy";

    /// <summary>Policy for users who have full administrative access.</summary>
    public const string Admin = "AdminPolicy";
}

/// <summary>
/// Extension methods to register Company Communicator authorization policies.
/// </summary>
public static class AuthorizationPoliciesExtensions
{
    /// <summary>
    /// Adds the <c>AuthorPolicy</c> and <c>AdminPolicy</c> authorization policies
    /// backed by Entra ID group membership claims from the JWT token.
    /// Group IDs are read from <c>Authorization:AuthorGroupId</c> and
    /// <c>Authorization:AdminGroupId</c> in application configuration.
    /// </summary>
    public static IServiceCollection AddCompanyCommunicatorAuthorization(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var authorGroupId = configuration["Authorization:AuthorGroupId"]
            ?? throw new InvalidOperationException(
                "Authorization:AuthorGroupId is not configured.");

        var adminGroupId = configuration["Authorization:AdminGroupId"]
            ?? throw new InvalidOperationException(
                "Authorization:AdminGroupId is not configured.");

        services.AddAuthorization(options =>
        {
            options.AddPolicy(PolicyNames.Author, policy =>
                policy
                    .RequireAuthenticatedUser()
                    .AddRequirements(new GroupMembershipRequirement(authorGroupId)));

            options.AddPolicy(PolicyNames.Admin, policy =>
                policy
                    .RequireAuthenticatedUser()
                    .AddRequirements(new GroupMembershipRequirement(adminGroupId)));
        });

        // Register the authorization handler.
        services.AddSingleton<IAuthorizationHandler, GroupMembershipHandler>();

        return services;
    }
}
