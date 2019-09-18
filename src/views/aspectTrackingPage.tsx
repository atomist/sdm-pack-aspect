import * as React from "react";
interface AspectPerformance {
    aspectName: string;
    runs: number;
    totalFingerprints: number;
    minMillis: number;
    maxMillis: number;
    failures: number;
    totalTimeTaken: number;
}
interface AspectTrackingProps {
    aspectPerformances: AspectPerformance[];
}

function displayAspectPerformance(world: { widthOfGraph: number, pixelsPerMilli: number }, ap: AspectPerformance): React.ReactElement {

    let belowLowWidth = Math.round(ap.minMillis * world.pixelsPerMilli);
    let betweenWidth = Math.round((ap.maxMillis - ap.minMillis) * world.pixelsPerMilli);
    if (betweenWidth < 5) {
        betweenWidth = 6;
        belowLowWidth = Math.max(0, belowLowWidth - 3);
    }
    if ((belowLowWidth + betweenWidth) > world.widthOfGraph) {
        belowLowWidth = world.widthOfGraph - betweenWidth;
    }

    return <tr>
        <td>{ap.aspectName}</td><td>{ap.runs}</td><td>{ap.totalFingerprints}</td>
        <td>{ap.failures}</td><td className="runTiming">{ap.minMillis}ms</td>
        <td><div className="envisionSpeed" style={{ width: world.widthOfGraph + "px" }}>
            <div className="belowLow" style={{ width: belowLowWidth + "px" }}>{ap.minMillis}</div>
            <div className="betweenLowAndHigh" style={{ width: betweenWidth + "px" }}
                title={ap.minMillis + "-" + ap.maxMillis + "ms"}>- {ap.maxMillis}</div>

        </div></td>
        <td className="runTiming">{ap.maxMillis}ms</td>
    </tr >;
}

function sortAspectPerformance(a1: AspectPerformance, a2: AspectPerformance): number {
    return a2.totalTimeTaken - a1.totalTimeTaken;
}

export function AspectTrackingPage(props: AspectTrackingProps): React.ReactElement {
    if (props.aspectPerformances.length === 0) {
        return <div>No analyses in progress.
            Start one at the command line:{" "}
            <span className="typeThisAtCommandLine">atomist analyze local repositories</span></div>;
    }

    const widthOfGraph = 500;
    const minniestMin = Math.min(...props.aspectPerformances.map(a => a.minMillis));
    const maxiestMax = Math.max(...props.aspectPerformances.map(a => a.maxMillis));
    const pixelsPerMilli = widthOfGraph / (maxiestMax - minniestMin);
    return <table>
        <thead><tr>
            <th>Name</th><th>Runs</th><th>FPs</th><th>Fails</th><th className="runHeader">Fastest run</th>
            <th><div style={{ width: widthOfGraph + "px" }}>
                <span className="minniestMin">{minniestMin} ms</span> --- Range of time taken ---
                <span className="maxiestMax">{maxiestMax} ms</span></div></th>
            <th className="runHeader">Slowest run</th>
        </tr></thead>
        {props.aspectPerformances.sort(sortAspectPerformance).map(ap => displayAspectPerformance({ widthOfGraph, pixelsPerMilli }, ap))}
    </table>;
}
