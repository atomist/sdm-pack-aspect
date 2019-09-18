module.exports = {
    mode: "development",
    entry: {
        sunburstScript: "./lib/page/sunburstScript.js"
    },
    output: {
        filename: "./lib/public/[name]-bundle.js",
        library: "SunburstYo"
    }
}