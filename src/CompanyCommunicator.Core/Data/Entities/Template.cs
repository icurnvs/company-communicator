using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CompanyCommunicator.Core.Data.Entities;

/// <summary>
/// Represents a reusable card template created by an author.
/// </summary>
public sealed class Template
{
    /// <summary>Gets or sets the unique identifier for the template.</summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; }

    /// <summary>Gets or sets the template display name.</summary>
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Gets or sets an optional description of the template.</summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>Gets or sets the structured card schema as JSON (same shape as the compose form state).</summary>
    [Required]
    [Column(TypeName = "nvarchar(max)")]
    public string CardSchema { get; set; } = "{}";

    /// <summary>Gets or sets the AAD OID of the user who created this template.</summary>
    [Required]
    [MaxLength(200)]
    public string CreatedBy { get; set; } = string.Empty;

    /// <summary>Gets or sets the UTC date and time when the template was created.</summary>
    public DateTime CreatedDate { get; set; }
}
