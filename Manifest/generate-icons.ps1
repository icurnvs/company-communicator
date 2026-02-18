# =============================================================================
# generate-icons.ps1 – Generate placeholder Teams app icons
#
# Creates two PNG files required by the Teams manifest:
#   color.png   – 192x192 pixels (full color icon, shown in app catalog)
#   outline.png – 32x32 pixels  (monochrome outline, shown in chat/tabs)
#
# Run this script to regenerate the placeholder icons if needed.
# Replace the output files with your organization's actual branding before
# publishing to the Teams app catalog.
#
# Requirements: Windows with .NET / System.Drawing available (PowerShell 5.1+)
# Or run on any machine with PowerShell 7+ and the instructions below.
#
# Usage:
#   cd Manifest
#   pwsh generate-icons.ps1
#
# For CI/CD: The package-manifest.yml workflow uses the checked-in PNG files
# directly. Re-run this script and commit the updated PNGs after rebranding.
# =============================================================================

Add-Type -AssemblyName System.Drawing

function New-PlaceholderIcon {
    param(
        [int]$Width,
        [int]$Height,
        [string]$OutputPath,
        [string]$BackgroundColor,
        [string]$TextColor,
        [string]$Label
    )

    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    # Background
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml($BackgroundColor)
    $graphics.Clear($bgColor)

    # Rounded rectangle border
    $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($TextColor), [float]([Math]::Max(1, $Width / 32)))
    $margin = [int]($Width * 0.05)
    $rect = [System.Drawing.Rectangle]::new($margin, $margin, $Width - 2 * $margin - 1, $Height - 2 * $margin - 1)
    $graphics.DrawRectangle($pen, $rect)

    # "CC" label centered
    $fontSize = [float]($Width * 0.3)
    $font = [System.Drawing.Font]::new("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($TextColor))
    $sf = [System.Drawing.StringFormat]::new()
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $labelRect = [System.Drawing.RectangleF]::new(0, 0, $Width, $Height)
    $graphics.DrawString($Label, $font, $brush, $labelRect, $sf)

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $font.Dispose()
    $brush.Dispose()
    $pen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()

    Write-Host "Created $OutputPath ($Width x $Height)"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# color.png: 192x192 with Fluent blue background, white text
New-PlaceholderIcon `
    -Width 192 `
    -Height 192 `
    -OutputPath (Join-Path $scriptDir "color.png") `
    -BackgroundColor "#0078D4" `
    -TextColor "#FFFFFF" `
    -Label "CC"

# outline.png: 32x32 with transparent-ish white background, dark text
# Teams requires the outline icon to be white/transparent for dark themes.
New-PlaceholderIcon `
    -Width 32 `
    -Height 32 `
    -OutputPath (Join-Path $scriptDir "outline.png") `
    -BackgroundColor "#FFFFFF" `
    -TextColor "#000000" `
    -Label "CC"

Write-Host ""
Write-Host "Placeholder icons generated. Replace color.png and outline.png with"
Write-Host "your organization's actual branding before publishing to the app catalog."
