import { matrixSales } from "@/api/matrixSalesClient";

/**
 * Auto-generates document numbers based on series configuration
 * Pattern: PREFIX-BRANCH-YEAR-NNNNNN
 * Example: QT-JED-25-000001, SO-RUH-25-000123
 */

export const getNextDocumentNumber = async (documentType, branchCode = 'ALL') => {
    try {
        // Get current year (last 2 digits)
        const currentYear = new Date().getFullYear().toString().slice(-2);
        
        // Fetch or create series for this document type
        const seriesList = await matrixSales.entities.DocumentNumberSeries.filter({
            document_type: documentType,
            branch_code: branchCode,
            fiscal_year: currentYear,
            status: 'active'
        });

        let series;
        
        if (seriesList.length === 0) {
            // Create new series
            const prefix = getDocumentPrefix(documentType);
            series = await matrixSales.entities.DocumentNumberSeries.create({
                series_id: `${prefix}-${branchCode}-${currentYear}`,
                document_type: documentType,
                prefix: prefix,
                branch_code: branchCode,
                fiscal_year: currentYear,
                current_number: 0,
                starting_number: 1,
                number_width: 6,
                format_pattern: `{PREFIX}-{BR}-{FY}-{NNNNNN}`,
                status: 'active',
                auto_generate: true
            });
        } else {
            series = seriesList[0];
        }

        // Increment counter
        const nextNumber = (series.current_number || 0) + 1;
        
        // Update series
        await matrixSales.entities.DocumentNumberSeries.update(series.id, {
            current_number: nextNumber,
            last_generated_number: formatDocumentNumber(series, nextNumber),
            last_generated_date: new Date().toISOString()
        });

        // Return formatted number
        return formatDocumentNumber(series, nextNumber);
        
    } catch (error) {
        console.error('Error generating document number:', error);
        // Fallback to timestamp-based number
        return `${getDocumentPrefix(documentType)}-${Date.now()}`;
    }
};

const formatDocumentNumber = (series, number) => {
    const paddedNumber = String(number).padStart(series.number_width || 6, '0');
    return `${series.prefix}-${series.branch_code}-${series.fiscal_year}-${paddedNumber}`;
};

const getDocumentPrefix = (documentType) => {
    const prefixMap = {
        // Sales
        'quotation': 'QT',
        'sales_order': 'SO',
        'delivery': 'DN',
        'invoice': 'INV',
        'credit_note': 'CN',
        'debit_note': 'DB',
        'sales_return': 'SR',
        'service_order': 'SVC',
        
        // Purchasing
        'purchase_requisition': 'PR',
        'rfq': 'RFQ',
        'purchase_order': 'PO',
        'grn': 'GRN',
        'vendor_invoice': 'VINV',
        
        // Production
        'production_order': 'PRD',
        'work_order': 'WO',
        'bom': 'BOM',
        'routing': 'RTG',
        'material_issue': 'MI',
        
        // Quality
        'inspection_lot': 'IL',
        'non_conformance': 'NC',
        'capa': 'CAPA',
        'coa': 'COA',
        
        // Inventory
        'stock_movement': 'SM',
        'stock_transfer': 'STO',
        'cycle_count': 'CC',
        
        // Finance
        'JE': 'JE',
        'journal_entry': 'JE',
        'payment': 'PAY',
        'receipt': 'RCP',
        'ar_invoice': 'AR',
        'ap_invoice': 'AP',
        
        // Maintenance
        'maintenance_wo': 'MWO',
        'pm_plan': 'PM',
        
        // Projects
        'project': 'PRJ',
        'timesheet': 'TS',
        'expense': 'EXP',
        'milestone': 'MS',
        'project_invoice': 'PINV',
        
        // CRM
        'lead': 'LD',
        'opportunity': 'OPP',
        'activity': 'ACT'
    };
    
    return prefixMap[documentType] || 'DOC';
};

export const validateDocumentNumber = (documentNumber, documentType) => {
    const prefix = getDocumentPrefix(documentType);
    return documentNumber && documentNumber.startsWith(prefix);
};

export const reserveDocumentNumber = async (documentType, branchCode = 'ALL') => {
    // Reserve a number without committing (for draft documents)
    return await getNextDocumentNumber(documentType, branchCode);
};
