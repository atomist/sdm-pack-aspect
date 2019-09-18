module.exports = {
    mode: "development",
    entry: {
        sunburstScript: "./dist/lib/page/sunburstScript.js"
    },
    output: {
        filename: "public/[name]-bundle.js",
        library: "SunburstYo"
    }
}