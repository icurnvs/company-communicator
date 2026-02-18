using CompanyCommunicator.Api.Authorization;
using CompanyCommunicator.Core.Models;
using CompanyCommunicator.Core.Services.Graph;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CompanyCommunicator.Api.Controllers;

/// <summary>
/// REST API endpoints for searching Entra ID (AAD) groups.
/// </summary>
[ApiController]
[Route("api/groups")]
[Authorize(Policy = PolicyNames.Author)]
[Produces("application/json")]
public sealed class GroupsController : ControllerBase
{
    private readonly IGraphService _graphService;

    /// <summary>
    /// Initializes a new instance of <see cref="GroupsController"/>.
    /// </summary>
    public GroupsController(IGraphService graphService)
    {
        _graphService = graphService;
    }

    /// <summary>
    /// Searches Entra ID groups whose display name starts with the specified query string.
    /// Returns up to 25 results.
    /// </summary>
    /// <param name="query">The prefix string to search for in group display names.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Array of up to 25 <see cref="GroupDto"/> results.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<GroupDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<GroupDto>>> SearchGroups(
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

        var groups = await _graphService.SearchGroupsAsync(query, ct).ConfigureAwait(false);

        var dtos = groups
            .Select(g => new GroupDto(g.Id, g.DisplayName))
            .ToList();

        return Ok(dtos);
    }
}
