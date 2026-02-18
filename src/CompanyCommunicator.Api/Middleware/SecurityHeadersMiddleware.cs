namespace CompanyCommunicator.Api.Middleware;

/// <summary>
/// ASP.NET Core middleware that appends security HTTP response headers to every response.
/// Protects against common browser-side attack vectors (clickjacking, MIME sniffing, etc.)
/// while also satisfying Teams embedding requirements via the CSP <c>frame-ancestors</c> directive.
/// </summary>
internal sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    /// <summary>
    /// Initializes a new instance of <see cref="SecurityHeadersMiddleware"/>.
    /// </summary>
    /// <param name="next">The next middleware delegate in the pipeline.</param>
    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    /// <summary>
    /// Processes the HTTP request, adds security headers, then invokes the next middleware.
    /// </summary>
    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        // Allow framing only within Teams/Skype origins (required for Teams tab embedding).
        headers["Content-Security-Policy"] =
            "frame-ancestors 'self' https://teams.microsoft.com " +
            "https://*.teams.microsoft.com https://*.skype.com";

        // Prevent MIME-type sniffing.
        headers["X-Content-Type-Options"] = "nosniff";

        // Deny framing from cross-origin (belt-and-suspenders alongside CSP).
        headers["X-Frame-Options"] = "SAMEORIGIN";

        // Control referrer information sent with requests.
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

        // Disable legacy XSS filter (it can introduce vulnerabilities in some browsers).
        headers["X-XSS-Protection"] = "0";

        // Restrict access to browser features.
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";

        await _next(context).ConfigureAwait(false);
    }
}

/// <summary>
/// Extension methods for registering <see cref="SecurityHeadersMiddleware"/>.
/// </summary>
public static class SecurityHeadersMiddlewareExtensions
{
    /// <summary>
    /// Adds the <see cref="SecurityHeadersMiddleware"/> to the request pipeline.
    /// Should be placed early in the pipeline, before authentication and routing.
    /// </summary>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
        => app.UseMiddleware<SecurityHeadersMiddleware>();
}
