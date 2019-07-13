
const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds

export function daysSince(date: Date): number {
    const now = new Date();
    return Math.round(Math.abs((now.getTime() - date.getTime()) / oneDay));
}