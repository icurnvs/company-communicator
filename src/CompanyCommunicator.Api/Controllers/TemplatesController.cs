using System.Text.Json;
using CompanyCommunicator.Api.Authorization;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanyCommunicator.Api.Controllers;

/// <summary>
/// REST API endpoints for managing reusable card templates.
/// Templates are scoped to the authenticated author — each author can only
/// read, update, or delete their own templates.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = PolicyNames.Author)]
[Produces("application/json")]
public sealed class TemplatesController : ControllerBase
{
    private readonly AppDbContext _db;

    /// <summary>
    /// Initializes a new instance of <see cref="TemplatesController"/>.
    /// </summary>
    /// <param name="db">The EF Core database context.</param>
    public TemplatesController(AppDbContext db)
    {
        _db = db;
    }

    // -------------------------------------------------------------------------
    // GET /api/templates
    // -------------------------------------------------------------------------

    /// <summary>
    /// Lists all templates owned by the calling author, ordered by creation date descending.
    /// </summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of <see cref="TemplateDto"/> for the current user.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(List<TemplateDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<List<TemplateDto>>> GetTemplates(CancellationToken ct)
    {
        var callerOid = GetCallerOid();
        if (callerOid is null)
        {
            return Unauthorized();
        }

        var templates = await _db.Templates
            .AsNoTracking()
            .Where(t => t.CreatedBy == callerOid)
            .OrderByDescending(t => t.CreatedDate)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var dtos = templates.Select(MapToDto).ToList();
        return Ok(dtos);
    }

    // -------------------------------------------------------------------------
    // GET /api/templates/{id}
    // -------------------------------------------------------------------------

    /// <summary>
    /// Gets a single template by ID. Returns 404 if the template does not exist
    /// or belongs to a different author.
    /// </summary>
    /// <param name="id">The template GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns><see cref="TemplateDto"/> when found; 404 otherwise.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TemplateDto>> GetTemplate(Guid id, CancellationToken ct)
    {
        var callerOid = GetCallerOid();
        if (callerOid is null)
        {
            return Unauthorized();
        }

        var template = await _db.Templates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            .ConfigureAwait(false);

        if (template is null || template.CreatedBy != callerOid)
        {
            return NotFound();
        }

        return Ok(MapToDto(template));
    }

    // -------------------------------------------------------------------------
    // POST /api/templates
    // -------------------------------------------------------------------------

    /// <summary>
    /// Creates a new template owned by the calling author.
    /// </summary>
    /// <param name="request">Template creation payload.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>201 Created with the new <see cref="TemplateDto"/> and Location header.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(TemplateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<TemplateDto>> CreateTemplate(
        [FromBody] CreateTemplateRequest request,
        CancellationToken ct)
    {
        var callerOid = GetCallerOid();
        if (callerOid is null)
        {
            return Unauthorized();
        }

        var validationError = ValidateTemplateRequest(request.Name, request.CardSchema);
        if (validationError is not null)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Validation failed",
                Detail = validationError,
                Status = StatusCodes.Status400BadRequest,
            });
        }

        var template = new Template
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            CardSchema = request.CardSchema,
            CreatedBy = callerOid,
            CreatedDate = DateTime.UtcNow,
        };

        _db.Templates.Add(template);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        var dto = MapToDto(template);
        return CreatedAtAction(nameof(GetTemplate), new { id = template.Id }, dto);
    }

    // -------------------------------------------------------------------------
    // PUT /api/templates/{id}
    // -------------------------------------------------------------------------

    /// <summary>
    /// Updates an existing template. Only the owning author may update their template.
    /// Returns 404 if the template does not exist or belongs to a different author.
    /// </summary>
    /// <param name="id">The template GUID.</param>
    /// <param name="request">Updated template payload.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Updated <see cref="TemplateDto"/>; 404 if not found or not owned; 400 if invalid.</returns>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TemplateDto>> UpdateTemplate(
        Guid id,
        [FromBody] UpdateTemplateRequest request,
        CancellationToken ct)
    {
        var callerOid = GetCallerOid();
        if (callerOid is null)
        {
            return Unauthorized();
        }

        var validationError = ValidateTemplateRequest(request.Name, request.CardSchema);
        if (validationError is not null)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Validation failed",
                Detail = validationError,
                Status = StatusCodes.Status400BadRequest,
            });
        }

        var template = await _db.Templates
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            .ConfigureAwait(false);

        if (template is null || template.CreatedBy != callerOid)
        {
            return NotFound();
        }

        template.Name = request.Name;
        template.Description = request.Description;
        template.CardSchema = request.CardSchema;

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        return Ok(MapToDto(template));
    }

    // -------------------------------------------------------------------------
    // DELETE /api/templates/{id}
    // -------------------------------------------------------------------------

    /// <summary>
    /// Deletes a template. Only the owning author may delete their template.
    /// Returns 404 if the template does not exist or belongs to a different author.
    /// </summary>
    /// <param name="id">The template GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>204 No Content; 404 if not found or not owned.</returns>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTemplate(Guid id, CancellationToken ct)
    {
        var callerOid = GetCallerOid();
        if (callerOid is null)
        {
            return Unauthorized();
        }

        var template = await _db.Templates
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            .ConfigureAwait(false);

        if (template is null || template.CreatedBy != callerOid)
        {
            return NotFound();
        }

        _db.Templates.Remove(template);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        return NoContent();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /// <summary>
    /// Returns the calling user's AAD Object ID from the JWT claims, or <see langword="null"/>
    /// if the claim is absent. Templates are keyed on OID, not UPN, to ensure uniqueness.
    /// </summary>
    private string? GetCallerOid()
    {
        return User.FindFirst("oid")?.Value
            ?? User.FindFirst("http://schemas.microsoft.com/identity/claims/objectidentifier")?.Value;
    }

    /// <summary>
    /// Validates the template name and card schema fields shared by create and update requests.
    /// Returns a human-readable error string when invalid, or <see langword="null"/> when valid.
    /// </summary>
    /// <param name="name">The template display name.</param>
    /// <param name="cardSchema">The JSON card schema string.</param>
    private static string? ValidateTemplateRequest(string name, string cardSchema)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return "Name is required.";
        }

        if (name.Length > 200)
        {
            return "Name must not exceed 200 characters.";
        }

        if (string.IsNullOrWhiteSpace(cardSchema))
        {
            return "CardSchema is required.";
        }

        if (!IsValidJson(cardSchema))
        {
            return "CardSchema must be valid JSON.";
        }

        return null;
    }

    /// <summary>
    /// Returns <see langword="true"/> when <paramref name="json"/> can be parsed as valid JSON.
    /// </summary>
    private static bool IsValidJson(string json)
    {
        try
        {
            JsonDocument.Parse(json);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    /// <summary>
    /// Maps a <see cref="Template"/> entity to a <see cref="TemplateDto"/>.
    /// </summary>
    private static TemplateDto MapToDto(Template template) =>
        new(
            template.Id,
            template.Name,
            template.Description,
            template.CardSchema,
            template.CreatedBy,
            template.CreatedDate);
}
