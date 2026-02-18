using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CompanyCommunicator.Api.Controllers;

/// <summary>
/// Authenticated health check endpoint separate from the unauthenticated /health/ready and /health/live endpoints.
/// </summary>
[ApiController]
[Route("api/health")]
[Authorize]
[Produces("application/json")]
public sealed class HealthController : ControllerBase
{
    /// <summary>
    /// Returns a simple health status object for any authenticated user.
    /// </summary>
    /// <returns>JSON object with status and current UTC timestamp.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public IActionResult GetHealth()
    {
        return Ok(new HealthResponse("healthy", DateTime.UtcNow));
    }

    /// <summary>Response body for the authenticated health endpoint.</summary>
    /// <param name="Status">Always "healthy" when the application is running.</param>
    /// <param name="Timestamp">The UTC timestamp of the response.</param>
    public sealed record HealthResponse(string Status, DateTime Timestamp);
}
