import { GitHubRepoRef } from "@atomist/automation-client";
import {
    ProviderType,
    PushImpactListenerInvocation,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import {
    Aspect,
    fingerprintRunner,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import { createFingerprintComputer } from "@atomist/sdm-pack-fingerprints/lib/machine/runner";

export async function extract(request: { repo: { owner: string, name: string, branch: string, providerId: string, apiUrl: string }, token: string, commit: { sha: string, message: string } }, cfg: SoftwareDeliveryMachineConfiguration): Promise<Array<FP<any>>> {
    const id = GitHubRepoRef.from({ owner: request.repo.owner, repo: request.repo.name, branch: request.repo.branch });
    const credentials = { token: request.token };
    return cfg.sdm.projectLoader.doWithProject({ id, credentials, readOnly: true }, async p => {

        // Run the fingerprint code
        const pi: PushImpactListenerInvocation = {
            context: undefined,
            configuration: cfg,
            project: p,
            addressChannels: undefined,
            preferences: undefined,
            credentials,
            id,
            impactedSubProject: p,
            filesChanged: undefined,
            commit: {
                sha: request.commit.sha,
                message: request.commit.message,
            },
            push: {
                repo: {
                    defaultBranch: request.repo.branch,
                    channels: [],
                    name: request.repo.name,
                    owner: request.repo.owner,
                    org: {
                        owner: request.repo.owner,
                        provider: {
                            apiUrl: request.repo.apiUrl,
                            providerId: request.repo.providerId,
                            providerType: ProviderType.github_com,
                        },
                    },
                },
                after: {
                    sha: request.commit.sha,
                    message: request.commit.message,
                },
                commits: [{
                    sha: request.commit.sha,
                    message: request.commit.message,
                }],
                branch: request.repo.branch,
                timestamp: new Date().toISOString(),
            },
        };

        const aspect = cfg.aspect as Aspect<any>;
        const fingerprintComputer = createFingerprintComputer([aspect]);
        const fps = await fingerprintRunner([aspect], [], fingerprintComputer, async i => {
            return true;
        })(pi);

        if (aspect.toDisplayableFingerprint) {
            fps.forEach(fp => {
                (fp as any).displayValue = aspect.toDisplayableFingerprint(fp);
            });
        }
        if (aspect.toDisplayableFingerprintName) {
            fps.forEach(fp => {
                (fp as any).displayName = aspect.toDisplayableFingerprintName(fp.name);
            });
        }

        return fps;
    });
}
