/**
 * Asset Tag Generator Utility
 * Generates unique asset tags and QR codes for fixed assets
 */

/**
 * Generate a unique asset tag number
 * Format: AT-YYYY-NNNNN (e.g., AT-2025-00001)
 */
export function generateAssetTag(lastTag = null) {
    const currentYear = new Date().getFullYear();
    
    if (!lastTag) {
        return `AT-${currentYear}-00001`;
    }
    
    // Parse the last tag to get the sequence number
    const parts = lastTag.split('-');
    if (parts.length === 3) {
        const year = parts[1];
        const sequence = parseInt(parts[2], 10);
        
        // If same year, increment sequence
        if (year === String(currentYear)) {
            const nextSequence = String(sequence + 1).padStart(5, '0');
            return `AT-${currentYear}-${nextSequence}`;
        }
    }
    
    // Different year or invalid format, start new sequence
    return `AT-${currentYear}-00001`;
}

/**
 * Generate QR code data for an asset
 * Returns a JSON string that can be encoded in a QR code
 */
export function generateAssetQRData(asset) {
    return JSON.stringify({
        asset_tag: asset.asset_tag,
        asset_number: asset.asset_number,
        asset_name: asset.asset_name,
        serial_number: asset.serial_number,
        location: asset.location_code,
        timestamp: new Date().toISOString()
    });
}

/**
 * Parse scanned QR code data
 */
export function parseAssetQRData(qrData) {
    try {
        return JSON.parse(qrData);
    } catch (error) {
        // If not JSON, assume it's just an asset tag
        return { asset_tag: qrData };
    }
}

/**
 * Generate barcode data in Code128 format
 * Compatible with most barcode scanners
 */
export function generateBarcodeData(assetTag) {
    // Remove hyphens for barcode compatibility
    return assetTag.replace(/-/g, '');
}

/**
 * Validate asset tag format
 */
export function validateAssetTag(tag) {
    const pattern = /^AT-\d{4}-\d{5}$/;
    return pattern.test(tag);
}

/**
 * Generate QR code SVG
 * Uses a simple QR generation approach
 */
export function generateQRCodeSVG(data, size = 200) {
    // For actual implementation, you'd use a QR library
    // This is a placeholder that creates a simple grid pattern
    const encoded = btoa(data);
    
    return `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${size}" height="${size}" fill="white"/>
            <text x="50%" y="50%" text-anchor="middle" fill="black" font-size="10">
                QR: ${data.substring(0, 20)}...
            </text>
            <rect x="10" y="10" width="20" height="20" fill="black"/>
            <rect x="${size - 30}" y="10" width="20" height="20" fill="black"/>
            <rect x="10" y="${size - 30}" width="20" height="20" fill="black"/>
        </svg>
    `;
}

/**
 * Generate asset tag label HTML for printing
 */
export function generateAssetTagLabel(asset, includeQR = true) {
    const qrData = generateAssetQRData(asset);
    const barcodeData = generateBarcodeData(asset.asset_tag);
    
    return `
        <div style="
            width: 4in; 
            height: 2in; 
            border: 2px solid #000; 
            padding: 10px; 
            font-family: Arial, sans-serif;
            page-break-after: always;
        ">
            <div style="display: flex; justify-content: space-between;">
                <div style="flex: 1;">
                    <h2 style="margin: 0; font-size: 18px; font-weight: bold;">
                        ${asset.asset_tag}
                    </h2>
                    <p style="margin: 5px 0; font-size: 14px; font-weight: bold;">
                        ${asset.asset_name}
                    </p>
                    <p style="margin: 3px 0; font-size: 11px; color: #666;">
                        Asset #: ${asset.asset_number}
                    </p>
                    ${asset.serial_number ? `
                        <p style="margin: 3px 0; font-size: 11px; color: #666;">
                            Serial: ${asset.serial_number}
                        </p>
                    ` : ''}
                    <p style="margin: 3px 0; font-size: 11px; color: #666;">
                        Location: ${asset.location_code || 'N/A'}
                    </p>
                    <div style="margin-top: 10px; font-family: 'Courier New', monospace; font-size: 16px; letter-spacing: 2px;">
                        ${barcodeData}
                    </div>
                </div>
                ${includeQR ? `
                    <div style="width: 100px; height: 100px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center;">
                        ${generateQRCodeSVG(qrData, 90)}
                    </div>
                ` : ''}
            </div>
            <div style="margin-top: 10px; font-size: 9px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 5px;">
                ${new Date().toLocaleDateString()} | Company Fixed Asset
            </div>
        </div>
    `;
}

/**
 * Bulk generate asset tags
 */
export async function bulkGenerateAssetTags(assets, startingTag = null) {
    let currentTag = startingTag;
    const updates = [];
    
    for (const asset of assets) {
        if (!asset.asset_tag) {
            currentTag = generateAssetTag(currentTag);
            updates.push({
                id: asset.id,
                asset_tag: currentTag
            });
        }
    }
    
    return updates;
}