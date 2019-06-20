import { ProjectAnalyzer } from "@atomist/sdm-pack-analysis";
import { ScmSearchCriteria } from "../ScmSearchCriteria";
import { Spider, SpiderOptions, SpiderResult } from "../Spider";

export class LocalSpider implements Spider {
    public async spider(criteria: ScmSearchCriteria,
                        analyzer: ProjectAnalyzer,
                        opts: SpiderOptions): Promise<SpiderResult> {

        const result: SpiderResult = {
            repositoriesDetected: 0,
            projectsDetected: 0,
            failed:
                [],
            keptExisting: [],
            persistedAnalyses: [],
        };
        return result;
    }

}
