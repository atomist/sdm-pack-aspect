import { ExtensionPackMetadata } from "@atomist/sdm";
import * as React from "react";
import * as ReactDOMServer from "react-dom/server";

export function renderStaticReactNode(body: React.ReactElement,
                                      title: string,
                                      instanceMetadata: ExtensionPackMetadata,
                                      extraScripts?: string[]): string {
    return ReactDOMServer.renderToStaticMarkup(
        TopLevelPage({
            bodyContent: body,
            pageTitle: title,
            instanceMetadata,
            extraScripts,
        }));
}

function extraScript(src: string): React.ReactElement {
    return <script src={src}></script>;
}

export function TopLevelPage(props: {
    bodyContent: React.ReactElement,
    pageTitle: string,
    instanceMetadata: ExtensionPackMetadata,
    extraScripts?: string[],
}): React.ReactElement {
    return <html>
        <head>
            <title>
                {props.pageTitle}
            </title>
            <link rel="stylesheet" type="text/css" href="/styles.css"></link>
            <meta name="google" content="notranslate" />
        </head>
        {(props.extraScripts || []).map(extraScript)}
        <body>
            <header>
                <div className="around-page-title">
                    <a href={"/"}><img className="atomist-logo" src="/atomist-logo-small-white.png" /></a>
                    <span className="page-title">
                        {props.pageTitle}
                    </span>
                    <span className="instance-info">
                        {props.instanceMetadata.name}
                    </span>
                </div>
            </header>
            <main>
                {props.bodyContent}
            </main>
        </body>
    </html>;
}
