using CompanyCommunicator.Api.Authorization;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanyCommunicator.Api.Controllers;

/// <summary>
/// REST API endpoints for querying Teams where the bot is installed.
/// </summary>
[ApiController]
[Route("api/teams")]
[Authorize(Policy = PolicyNames.Author)]
[Produces("application/json")]
public sealed class TeamsController : ControllerBase
{
    private readonly AppDbContext _db;

    /// <summary>
    /// Initializes a new instance of <see cref="TeamsController"/>.
    /// </summary>
    public TeamsController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Lists all Teams where the Company Communicator bot is installed, ordered by name.
    /// </summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Array of <see cref="TeamDto"/> ordered alphabetically by name.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<TeamDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TeamDto>>> GetTeams(CancellationToken ct)
    {
        var teams = await _db.Teams
            .AsNoTracking()
            .OrderBy(t => t.Name)
            .Select(t => new TeamDto(t.TeamId, t.Name))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return Ok(teams);
    }
}
