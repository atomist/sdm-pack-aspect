/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    ClientLogging,
    configureLogging,
} from "@atomist/automation-client";
import {
    Request,
    Response,
} from "express";
import { extract } from "./aspect";
import { configure } from "./configuration";

configureLogging(ClientLogging);

export interface AspectRequest {
    method: "extract" | "apply";
    configuration: {
        apiKey: string;
    };
    repo: { owner: string, name: string, branch: string, providerId: string, apiUrl: string };
    token: string;
    commit: { sha: string, message: string };
}

export const aspectEndpoint = async (req: Request, res: Response) => {
    if (req.method !== "POST") {
        res.status(404);
        res.send("");
        return;
    }

    const payload = req.body as AspectRequest;
    if (!!payload && !!payload.method) {
        if (payload.method === "extract") {
            const configuration = await configure(payload.configuration || {});
            const fps = await extract(payload, configuration);
            res.json(fps);
            return;
        } else if (payload.method === "apply") {
            const configuration = await configure(payload.configuration || {});
            res.status(200);
            res.send("");
            return;
        }
    }
    res.status(422);
    res.send("");
};
