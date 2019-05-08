// See https://bl.ocks.org/alandunning/18c5ec8d06938edd31968e2fd104a58a

function scatter(dataUrl, pWidth, pHeight) {

    console.log("Data url=" + dataUrl);

    const width = pWidth || window.innerWidth,
        height = pHeight || window.innerHeight;

    const svg = d3.select("#scatter"),
        margin = { top: 20, right: 20, bottom: 30, left: 50 },
        domainwidth = width - margin.left - margin.right,
        domainheight = height - margin.top - margin.bottom;

    const x = d3.scaleLinear()
        .domain(padExtent([0, 42]))
        .range(padExtent([0, domainwidth]));
    const y = d3.scaleLinear()
        .domain(padExtent([0, 10]))
        .range(padExtent([domainheight, 0]));

    const g = svg.append("g")
        .attr("transform", "translate(" + margin.top + "," + margin.top + ")");

    g.append("rect")
        .attr("width", width - margin.left - margin.right)
        .attr("height", height - margin.top - margin.bottom)
        .attr("fill", "#F6F6F6");

    d3.json(dataUrl, function (error, data) {
        if (error) throw error;

        data.forEach(function (d) {
            console.log("data is ");
            console.log(d);
            d.recency = +d.recency;
            d.frequency = +d.frequency;
        });

        g.selectAll("circle")
            .data(data)
            .enter().append("circle")
            .attr("class", "dot")
            .attr("r", 7) // radius of the dot
            .attr("cx", function (d) {
                return x(d.recency);
            })
            .attr("cy", function (d) {
                return y(d.frequency);
            })
            .style("fill", function (d) {
                if (d.frequency >= 3 && d.recency <= 3) {
                    return "#60B19C"
                } // Top Left
                else if (d.frequency >= 3 && d.recency >= 3) {
                    return "#8EC9DC"
                } // Top Right
                else if (d.frequency <= 3 && d.recency >= 3) {
                    return "#D06B47"
                } // Bottom Left
                else {
                    return "#A72D73"
                } //Bottom Right
            });

        console.log("What is y.range? " + y.range());
        g.append("g")
            .attr("class", "x axis")
           // .attr("transform", "translate(0," + y.range()[0] / 2 + ")")
            .call(d3.axisBottom(x).ticks(15));

        g.append("g")
            .attr("class", "y axis")
           // .attr("transform", "translate(" + x.range()[1] / 2 + ", 0)")
            .call(d3.axisLeft(y).ticks(35));
    });

}

function padExtent(e, p) {
    if (p === undefined) p = 1;
    return ([e[0] - p, e[1] + p]);
}

