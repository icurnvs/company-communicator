using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Models;

namespace CompanyCommunicator.Api.Validation;

/// <summary>
/// Server-side input validation helpers for API request payloads.
/// All validation is performed server-side regardless of client-side validation.
/// </summary>
internal static class InputValidator
{
    private static readonly string[] AllowedAudienceTypes =
    {
        AudienceType.Team,
        AudienceType.Roster,
        AudienceType.Group,
    };

    /// <summary>
    /// Validates a URL value. Only absolute <c>https://</c> URIs are accepted.
    /// Rejects <c>javascript:</c>, <c>data:</c>, <c>http://</c>, and relative URIs.
    /// </summary>
    /// <param name="url">The URL to validate. Null values are considered valid (field is optional).</param>
    /// <returns>
    /// A tuple where <c>IsValid</c> is <c>true</c> when the URL is null or a valid https URI,
    /// and <c>ErrorMessage</c> contains a human-readable description of the violation when invalid.
    /// </returns>
    public static (bool IsValid, string? ErrorMessage) ValidateUrl(string? url)
    {
        if (url is null)
        {
            return (true, null);
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return (false, $"'{url}' is not a valid absolute URI.");
        }

        if (!string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase))
        {
            return (false, $"Only https:// URIs are accepted. Received scheme '{uri.Scheme}'.");
        }

        return (true, null);
    }

    /// <summary>
    /// Validates a <see cref="CreateNotificationRequest"/> payload.
    /// </summary>
    /// <param name="request">The request to validate.</param>
    /// <returns>
    /// A tuple where <c>IsValid</c> is <c>true</c> when all fields pass validation,
    /// and <c>ErrorMessage</c> contains the first encountered validation error when invalid.
    /// </returns>
    public static (bool IsValid, string? ErrorMessage) ValidateNotificationRequest(
        CreateNotificationRequest request)
    {
        return ValidateNotificationFields(
            request.Title,
            request.Summary,
            request.ImageLink,
            request.ButtonTitle,
            request.ButtonLink,
            request.Audiences);
    }

    /// <summary>
    /// Validates an <see cref="UpdateNotificationRequest"/> payload.
    /// </summary>
    /// <param name="request">The request to validate.</param>
    /// <returns>
    /// A tuple where <c>IsValid</c> is <c>true</c> when all fields pass validation,
    /// and <c>ErrorMessage</c> contains the first encountered validation error when invalid.
    /// </returns>
    public static (bool IsValid, string? ErrorMessage) ValidateNotificationRequest(
        UpdateNotificationRequest request)
    {
        return ValidateNotificationFields(
            request.Title,
            request.Summary,
            request.ImageLink,
            request.ButtonTitle,
            request.ButtonLink,
            request.Audiences);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private static (bool IsValid, string? ErrorMessage) ValidateNotificationFields(
        string title,
        string? summary,
        string? imageLink,
        string? buttonTitle,
        string? buttonLink,
        IReadOnlyList<AudienceDto>? audiences)
    {
        // Title: required, max 200
        if (string.IsNullOrWhiteSpace(title))
        {
            return (false, "Title is required.");
        }

        if (title.Length > 200)
        {
            return (false, "Title must not exceed 200 characters.");
        }

        // Summary: optional, max 4000
        if (summary is not null && summary.Length > 4000)
        {
            return (false, "Summary must not exceed 4000 characters.");
        }

        // ImageLink: optional, must be https if provided
        var (imageLinkValid, imageLinkError) = ValidateUrl(imageLink);
        if (!imageLinkValid)
        {
            return (false, $"ImageLink is invalid: {imageLinkError}");
        }

        // ButtonTitle: optional, max 200
        if (buttonTitle is not null && buttonTitle.Length > 200)
        {
            return (false, "ButtonTitle must not exceed 200 characters.");
        }

        // ButtonLink: optional, must be https if provided
        var (buttonLinkValid, buttonLinkError) = ValidateUrl(buttonLink);
        if (!buttonLinkValid)
        {
            return (false, $"ButtonLink is invalid: {buttonLinkError}");
        }

        // Audiences: each entry must have a valid AudienceType and a non-empty AudienceId
        if (audiences is not null)
        {
            foreach (var audience in audiences)
            {
                if (!AllowedAudienceTypes.Contains(audience.AudienceType, StringComparer.Ordinal))
                {
                    return (false,
                        $"AudienceType '{audience.AudienceType}' is not valid. " +
                        $"Allowed values: {string.Join(", ", AllowedAudienceTypes)}.");
                }

                if (string.IsNullOrWhiteSpace(audience.AudienceId))
                {
                    return (false, "AudienceId must not be empty.");
                }

                if (!Guid.TryParse(audience.AudienceId, out _))
                {
                    return (false, $"AudienceId '{audience.AudienceId}' must be a valid GUID for audience type {audience.AudienceType}.");
                }
            }
        }

        return (true, null);
    }
}
