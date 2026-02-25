export function getLevenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

export function fuzzyTitleMatchScore(query: string, title: string): number {
    const qWords = query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2); // rely on 3+ char words
    const tText = title.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const tWords = tText.split(/\s+/).filter(w => w.length > 0);

    if (qWords.length === 0) {
        // Fallback for short queries like 'kgf'
        const rawQ = query.toLowerCase().replace(/[^a-z0-9]/g, '');
        return tText.includes(rawQ) ? 0 : getLevenshteinDistance(rawQ, tText.replace(/\s+/g, '').substring(0, rawQ.length));
    }

    let score = 0;
    for (const q of qWords) {
        if (!tText.includes(q)) {
            let best = 99;
            for (const t of tWords) {
                best = Math.min(best, getLevenshteinDistance(q, t));
            }
            score += best;
        }
    }
    return score;
}
