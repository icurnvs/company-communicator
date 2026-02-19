using CompanyCommunicator.Api.Authorization;
using CompanyCommunicator.Core.Models;
using CompanyCommunicator.Core.Services.Graph;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CompanyCommunicator.Api.Controllers;

/// <summary>
/// REST API endpoints for searching Teams (for General channel delivery).
/// Searches Entra ID groups that are Teams-enabled via Microsoft Graph.
/// </summary>
[ApiController]
[Route("api/teams")]
[Authorize(Policy = PolicyNames.Author)]
[Produces("application/json")]
public sealed class TeamsController : ControllerBase
{
    private readonly IGraphService _graphService;

    /// <summary>
    /// Initializes a new instance of <see cref="TeamsController"/>.
    /// </summary>
    public TeamsController(IGraphService graphService)
    {
        _graphService = graphService;
    }

    /// <summary>
    /// Searches for Teams whose display name starts with the given query string.
    /// Returns up to 25 matching results, each identified by AAD group ID.
    /// </summary>
    /// <param name="query">The search prefix (minimum 1 character).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Array of <see cref="TeamDto"/> matching the query.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<TeamDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<TeamDto>>> SearchTeams(
        [FromQuery] string query,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Validation failed",
                Detail = "The 'query' parameter is required.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        var teams = await _graphService.SearchTeamsAsync(query, ct).ConfigureAwait(false);

        var dtos = teams
            .Select(t => new TeamDto(t.Id, t.DisplayName))
            .ToList();

        return Ok(dtos);
    }
}
