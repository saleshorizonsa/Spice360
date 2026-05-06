/**
 * Depreciation Calculator Utility
 * Handles depreciation calculations for fixed assets
 */

/**
 * Calculate monthly depreciation using Straight Line method
 */
export function calculateStraightLineDepreciation(acquisitionCost, salvageValue, usefulLifeYears) {
    const depreciableAmount = acquisitionCost - salvageValue;
    const annualDepreciation = depreciableAmount / usefulLifeYears;
    const monthlyDepreciation = annualDepreciation / 12;
    
    return {
        annual: annualDepreciation,
        monthly: monthlyDepreciation,
        rate: (annualDepreciation / acquisitionCost) * 100
    };
}

/**
 * Calculate depreciation using Declining Balance method (Double-Declining)
 */
export function calculateDecliningBalanceDepreciation(acquisitionCost, salvageValue, usefulLifeYears, currentBookValue) {
    const rate = (2 / usefulLifeYears) * 100; // Double-declining rate
    const annualDepreciation = currentBookValue * (rate / 100);
    const monthlyDepreciation = annualDepreciation / 12;
    
    // Ensure NBV doesn't go below salvage value
    const maxDepreciation = currentBookValue - salvageValue;
    const actualAnnualDepreciation = Math.min(annualDepreciation, maxDepreciation);
    const actualMonthlyDepreciation = actualAnnualDepreciation / 12;
    
    return {
        annual: actualAnnualDepreciation,
        monthly: actualMonthlyDepreciation,
        rate: rate
    };
}

/**
 * Calculate depreciation schedule for entire asset life
 */
export function generateDepreciationSchedule(
    assetNumber,
    assetName,
    acquisitionDate,
    acquisitionCost,
    salvageValue,
    usefulLifeYears,
    method = 'straight_line'
) {
    const schedule = [];
    const startDate = new Date(acquisitionDate);
    let currentBookValue = acquisitionCost;
    let accumulatedDepreciation = 0;
    
    for (let year = 1; year <= usefulLifeYears; year++) {
        let yearlyDepreciation;
        
        if (method === 'straight_line') {
            const calc = calculateStraightLineDepreciation(acquisitionCost, salvageValue, usefulLifeYears);
            yearlyDepreciation = calc.annual;
        } else if (method === 'declining_balance') {
            const calc = calculateDecliningBalanceDepreciation(
                acquisitionCost, 
                salvageValue, 
                usefulLifeYears, 
                currentBookValue
            );
            yearlyDepreciation = calc.annual;
        }
        
        // Ensure we don't depreciate below salvage value
        if (currentBookValue - yearlyDepreciation < salvageValue) {
            yearlyDepreciation = currentBookValue - salvageValue;
        }
        
        accumulatedDepreciation += yearlyDepreciation;
        currentBookValue -= yearlyDepreciation;
        
        const fiscalYear = startDate.getFullYear() + (year - 1);
        
        // Generate monthly entries
        const monthlyDepreciation = yearlyDepreciation / 12;
        for (let month = 1; month <= 12; month++) {
            const period = String(month).padStart(2, '0');
            const depDate = new Date(fiscalYear, month - 1, 1);
            
            schedule.push({
                depreciation_id: `DEP-${assetNumber}-${fiscalYear}-${period}`,
                asset_number: assetNumber,
                asset_name: assetName,
                fiscal_year: String(fiscalYear),
                period: period,
                depreciation_date: depDate.toISOString().split('T')[0],
                depreciation_amount: monthlyDepreciation,
                accumulated_depreciation: accumulatedDepreciation - (yearlyDepreciation - (monthlyDepreciation * month)),
                net_book_value: acquisitionCost - (accumulatedDepreciation - (yearlyDepreciation - (monthlyDepreciation * month))),
                depreciation_method: method,
                depreciation_rate: (yearlyDepreciation / acquisitionCost) * 100,
                gl_posted: false
            });
        }
    }
    
    return schedule;
}

/**
 * Calculate current depreciation status for an asset
 */
export function calculateCurrentDepreciationStatus(
    acquisitionDate,
    acquisitionCost,
    salvageValue,
    usefulLifeYears,
    method = 'straight_line'
) {
    const startDate = new Date(acquisitionDate);
    const currentDate = new Date();
    const monthsElapsed = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                         (currentDate.getMonth() - startDate.getMonth());
    
    let accumulatedDepreciation = 0;
    let currentBookValue = acquisitionCost;
    
    if (method === 'straight_line') {
        const calc = calculateStraightLineDepreciation(acquisitionCost, salvageValue, usefulLifeYears);
        accumulatedDepreciation = Math.min(calc.monthly * monthsElapsed, acquisitionCost - salvageValue);
    } else if (method === 'declining_balance') {
        for (let month = 0; month < monthsElapsed; month++) {
            const calc = calculateDecliningBalanceDepreciation(
                acquisitionCost,
                salvageValue,
                usefulLifeYears,
                currentBookValue
            );
            const monthlyDep = Math.min(calc.monthly, currentBookValue - salvageValue);
            accumulatedDepreciation += monthlyDep;
            currentBookValue -= monthlyDep;
            
            if (currentBookValue <= salvageValue) break;
        }
    }
    
    const netBookValue = acquisitionCost - accumulatedDepreciation;
    const remainingLife = (usefulLifeYears * 12) - monthsElapsed;
    
    return {
        accumulated_depreciation: accumulatedDepreciation,
        net_book_value: Math.max(netBookValue, salvageValue),
        months_elapsed: monthsElapsed,
        remaining_life_months: Math.max(remainingLife, 0),
        is_fully_depreciated: netBookValue <= salvageValue
    };
}

/**
 * Run monthly depreciation for all active assets
 */
export async function runMonthlyDepreciation(assets, fiscalYear, period) {
    const depreciationEntries = [];
    
    for (const asset of assets) {
        if (asset.status !== 'active') continue;
        
        const status = calculateCurrentDepreciationStatus(
            asset.acquisition_date,
            asset.acquisition_cost,
            asset.salvage_value || 0,
            asset.useful_life_years,
            asset.depreciation_method
        );
        
        if (status.is_fully_depreciated) continue;
        
        const calc = asset.depreciation_method === 'straight_line'
            ? calculateStraightLineDepreciation(
                asset.acquisition_cost,
                asset.salvage_value || 0,
                asset.useful_life_years
              )
            : calculateDecliningBalanceDepreciation(
                asset.acquisition_cost,
                asset.salvage_value || 0,
                asset.useful_life_years,
                status.net_book_value
              );
        
        depreciationEntries.push({
            depreciation_id: `DEP-${asset.asset_number}-${fiscalYear}-${period}`,
            asset_number: asset.asset_number,
            asset_name: asset.asset_name,
            fiscal_year: fiscalYear,
            period: period,
            depreciation_date: new Date().toISOString().split('T')[0],
            depreciation_amount: calc.monthly,
            accumulated_depreciation: status.accumulated_depreciation + calc.monthly,
            net_book_value: status.net_book_value - calc.monthly,
            depreciation_method: asset.depreciation_method,
            depreciation_rate: calc.rate,
            gl_posted: false
        });
    }
    
    return depreciationEntries;
}