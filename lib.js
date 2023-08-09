const crimes = ["dacoity", "robbery ", "murder", "riot ", "woman_child_Repression", "kidnapping", "police_assault", "burglary", "theft", "other_cases"]
const crimeDataURL = "bangladeshi-crime-data/crime_data_bangladesh.csv";
const tier1mapDataURL = "bangladeshi-crime-data/bangladesh_geojson_adm1_8_divisions_bibhags.json";
const tier2mapDataURL = "bangladeshi-crime-data/bangladesh_geojson_adm2_64_districts_zillas.json";

let highlightColour = "red"
let tier1highlightStrokeWidth = 2
let tier2highlightStrokeWidth = 2
let tier1normalStrokeWidth = 2
let tier2normalStrokeWidth = 0
let tier1normalColour = "black"
let tier2normalColour = "grey"

function getDataPoint(area_name, crime, year, include_split_regions) {

    if (include_split_regions == undefined) { console.trace() }

    if (include_split_regions) {
        // mymensingh only split from dhaka in 2015
        if (area_name == "mymensingh division" && year < 2016) { area_name = "dhaka division" }

        // rajshahi split from rangpur earlier but some of the data is missing
        if (area_name == "rangpur metropolitan" && year < 2017) { area_name = "rangpur division" }
        if (area_name == "rangpur division" && year < 2012) { area_name = "rajshahi division" }
    }


    const dataline = crimeData.find(d => { return d.area_name === area_name && +d.year === +year; })
    return dataline !== undefined ? +dataline[crime] : "no data"
}

// mapping from geo data -> crime data
function tierNamesToAreaNames(tier1name, tier2name) {
    if (tier1name == "Mymensingh") { return "mymensingh division" }
    tier2name = tier2name == "Rongpur" ? "Rangpur" : tier2name
    return tier1name == tier2name ? tier1name.toLowerCase() + " metropolitan" : tier1name.toLowerCase() + " division";
}

function tier2FeatureCrimeAndYearToDatapoint(tier2Feature, crime, year, include_split_regions) {
    return getDataPoint(tier2featureToAreaName(tier2Feature), crime, year, include_split_regions);
}


// mapping from tier 2 feature object -> area name
function tier2featureToAreaName(tier2Feature) {
    const tier1Division = tier2Feature.properties.ADM1_EN;
    const tier2Division = tier2Feature.properties.ADM2_EN;
    return tierNamesToAreaNames(tier1Division, tier2Division);
}

// this function used to be very slow so I've optimised it
// the path onmouseover event isn't perfect, and only triggers on the mouse moving over a region border
// as far as I know, there is no event for the mouse moving inside a region
// so we keep a set (hoveringRegionsCaches) of regions the mouse has recently touched the border of.
// sometimes, for whatever reason, the mouse can move inside of a region without triggering an onmousemove event,
// so we don't a matching region in the above cached ones, then we check all regions
function getRegionsAtPoint(point) {
    const [longitude, latitude] = point

    // check to see if the cursor is inside a region
    // and reset the cached set of regions if we find a match
    checkFeature = feature => {
        if (d3.geoContains(feature, [longitude, latitude])) {
            tier2Region = feature
            hoveringRegionsCache = new Set([tier2Region]);
        }
    }

    var tier2Region = null;

    // first, check the cached set of regions
    hoveringRegionsCache.forEach(checkFeature);

    // if we don't find one, check each region
    if (tier2Region == null) {
        tier2geoData.features.forEach(checkFeature)
    }

    return {
        tier1Name: tier2Region ? tier2Region.properties.ADM1_EN : null,
        tier2Name: tier2Region ? tier2Region.properties.ADM2_EN : null
    };
}

function drawRegions(tier1geoData, tier2geoData, mapsvg) {

    mapsvg.selectAll(".tier1")
        .data(tier1geoData.features)
        .enter()
        .append("path")
        .attr("fill", "none")
        .attr("class", "tier1")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", tier1normalColour)
        .attr("stroke-width", tier1normalStrokeWidth);

    mapsvg.selectAll(".tier2")
        .data(tier2geoData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("class", "tier2")
        .attr("stroke", tier2normalColour)
        .attr("stroke-width", tier2normalStrokeWidth)
        // whenever the cursor touches a region's border, add it to the cached regions
        .on("mouseover", (event, feature) => {
            hoveringRegionsCache.add(feature);
        })
        .on("mouseenter", (event, feature) => {
            hoveringRegionsCache.add(feature);
        })
        .on("mouseleave", (event, feature) => {
            hoveringRegionsCache.add(feature);
        })
        .on("mousemove", (event, feature) => {
            hoveringRegionsCache.add(feature);
        });

}

function getDataRange(areas, years, crime, include_split_regions) {
    if (include_split_regions == undefined) { console.trace() }
    fullRange = [];
    areas.forEach(area => {
        years.forEach(year => {
            dataPoint = getDataPoint(area, crime, year, include_split_regions); if (dataPoint !== "no data") { fullRange.push(+dataPoint) }
        })
    });
    return { rangeMin: d3.min(fullRange), rangeMax: d3.max(fullRange) };
}

function getAllAreaNames() {
    allAreaNamesWDuplicates = []
    crimeData.forEach(d => allAreaNamesWDuplicates.push(d.area_name));
    return [...new Set(allAreaNamesWDuplicates)];
}

function getAllYears() {
    return d3.range(2010, 2020);
}

function prettifyCrimeName(raw_crime_name) {
    raw_crime_name = raw_crime_name == "dacoity" ? "gang robbery" : raw_crime_name
    no_underscores = raw_crime_name.replaceAll("man_child", "man & child").replaceAll("_", " ").toLowerCase().trim();
    return no_underscores[0].toUpperCase() + no_underscores.substr(1).toLowerCase()
}

function prettifyAreaName(raw_area_name) {
    return raw_area_name[0].toUpperCase() + raw_area_name.substr(1)
}

function getURLparam(param) {
    // Get the query string from the URL
    var queryString = window.location.search;

    // Parse the query string and extract the parameter
    var urlParams = new URLSearchParams(queryString);
    return urlParams.get(param);
}

// account for the spaces in the CSV
function fixURLCrimeName(crime) {
    return (crime == "robbery" || crime == "riot") ? crime + " " : crime;
}

function dotProduct(v1, v2) {
    console.assert(v1.length == v2.length)

    let result = 0;
    for (let i = 0; i < v1.length; i++) {
        result += v1[i] * v2[i];
    }
    return result;

}

function norm(v) {
    let sumOfSquares = 0;
    for (let i = 0; i < v.length; i++) {
        sumOfSquares += v[i] * v[i];
    }
    return Math.sqrt(sumOfSquares);
}

function subtractVector(a, b) {
    return sumVectors(a, scaleVector(b, -1))
}

function denormaliseVector(v, means, sds) {
    const denormalised = [];
    const numElements = v.length;

    for (let i = 0; i < numElements; i++) {
        denormalised.push(v[i] * sds[i] + means[i]);
    }

    return denormalised;
}

// normalise the matrix so that each column has mean 0 and sd 1
function normaliseMatrix(M) {
    const means = [];
    const sdevs = [];
    const numRows = M.length;
    const numCols = M[0].length;

    for (let col = 0; col < numCols; col++) {
        let sum = 0;
        for (let row = 0; row < numRows; row++) {
            sum += M[row][col];
        }
        const mean = sum / numRows;
        means.push(mean);

        let varianceSum = 0;
        for (let row = 0; row < numRows; row++) {
            varianceSum += Math.pow(M[row][col] - mean, 2);
        }
        const variance = varianceSum / numRows;
        const sdev = Math.sqrt(variance);
        sdevs.push(sdev);
    }

    const normalised = [];
    for (let row = 0; row < numRows; row++) {
        const newRow = [];
        for (let col = 0; col < numCols; col++) {
            newRow.push((M[row][col] - means[col]) / sdevs[col]);
        }
        normalised.push(newRow);
    }

    return { normalised: normalised, means: means, sdevs: sdevs };
}

// use PCA to predict # crimes per area (using 1 component)
function calculateCrimeExpectancyDeviations(include_split_regions, per_year) {

    if (per_year == undefined) { console.trace() }

    areaIndex = []
    yearIndex = []
    // crimeIndex=[]

    if (!per_year) {

        // get matrix of crime data per area (averaged per crime across years)
        denormalisedCrimeDataMatrix = []
        areas = getAllAreaNames();
        for (area of areas) {
            denormalisedCrimeDataMatrix.push(getAreaDataVector(area, include_split_regions))
            areaIndex.push(area)
        }
    }

    else if (per_year) {
        denormalisedCrimeDataMatrix = []
        areas = getAllAreaNames();
        for (area of areas) {
            for (year of getAllYears()) {
                v = getAreaYearDataVector(area, year, include_split_regions)
                if (v !== "no data") {
                    denormalisedCrimeDataMatrix.push(v)
                    areaIndex.push(area)
                    yearIndex.push(year)
                }
            }
        }
    }

    // normalise it to be appropriate for PCA
    const { normalised: normalisedCrimeDataMatrix, means: means, sdevs: sdevs } = normaliseMatrix(denormalisedCrimeDataMatrix);


    // reconstruct predictions from 1d representations
    // code taken from https://github.com/bitanath/pca
    var vectors = PCA.getEigenVectors(normalisedCrimeDataMatrix);

    // calculate severities "crime index" for each area and reconstruct predictions
    severities = []
    predictions = []

    for (i of normalisedCrimeDataMatrix) {

        // calculate component in v0 direction
        component = dotProduct(i, vectors[0].vector) // crime index
        component2 = dotProduct(i, vectors[1].vector) // second component
        severities.push(component)
        scaled = scaleVector(vectors[0].vector, component)
        // scaled = sumVectors(scaleVector(vectors[0].vector, component),scaleVector(vectors[1].vector, component2))

        // denormalise component
        denormalised = denormaliseVector(scaled, means, sdevs)

        predictions.push(denormalised)
    }

    return { crimeIndex: crimes, areaIndex: areaIndex, predictionMatrix: predictions, area_severities: severities, yearIndex: yearIndex }
}

// given an area, turn crime data into a vector (by averaging across years)
function getAreaDataVector(area, include_split_regions) {
    total = null
    n = 0
    // not including 2019 data since it's incomplete
    for (year of d3.range(2010, 2019)) {
        v = getAreaYearDataVector(area, year, include_split_regions)
        if (v == "no data") { continue }
        if (total == null) { total = v; n = 1 }
        else { total = sumVectors(total, v); n += 1 }
    }
    result = scaleVector(total, 1 / n)
    return result
}

// given an area and a year, turn the crime data into a vector
function getAreaYearDataVector(area, year, include_split_regions) {
    v = []
    for (crime of crimes) {
        dp = getDataPoint(area, crime, year, include_split_regions)
        if (dp == "no data") { return "no data" }
        v.push(dp)
    }
    return v
}

// sum two vectors elementwise
function sumVectors(vector1, vector2) {
    var result = [];
    console.assert(vector1.length == vector2.length)
    for (var i = 0; i < vector1.length; i++) {
        result.push(+vector1[i] + +vector2[i]);
    }
    return result;
}

function getCurrentDataRangeChoropleth() {
    return getDataRange(getAllAreaNames(), [getSelectedYear()], getSelectedCrime(), true);
}

// multiply vector by scalar
function scaleVector(vector, alpha) {
    var result = [];
    for (var i = 0; i < vector.length; i++) {
        result.push(vector[i] * alpha);
    }
    return result;
}

// used to locate the appropriate row index when extracting predictions from pca
function calculateRowMatch(year, area, yearIndex, areaIndex) {
    for (let i = 0; i < yearIndex.length; i++) {
        if (+yearIndex[i] === +year && areaIndex[i] === area) {
            return i;
        }
    }
    console.log(year, area, yearIndex, areaIndex)
    return -1;
}


// given deviation data calculated from above, compare the observed value to the expected value and calculate the deviation
function calculateDeviationFromExpectation(deviationData, year, area, crime, include_split_regions, per_year) {
    if (per_year == undefined) { console.trace() }
    if (!per_year) {
        observedValue = getDataPoint(area, crime, year, include_split_regions)
        i = deviationData.areaIndex.indexOf(area)
        j = deviationData.crimeIndex.indexOf(crime)
        expectedValue = deviationData.predictionMatrix[i][j]

    }
    else {
        observedValue = getDataPoint(area, crime, year, include_split_regions)
        j = deviationData.crimeIndex.indexOf(crime)
        predictionRowIndex = calculateRowMatch(year, area, deviationData.yearIndex, deviationData.areaIndex)
        expectedValue = deviationData.predictionMatrix[predictionRowIndex][j]
    }
    if (expectedValue <= 0) { deviation = Infinity; expectedValue = 0; }
    else { deviation = (observedValue - expectedValue) / expectedValue }
    return { expectedValue: expectedValue, deviation: deviation }
}

function updateChoroplethTooltip(event) {
    // get cursor location
    const point = d3.pointer(event);

    // conver to lat and long
    const [longitude, latitude] = projection.invert(point);
    const { tier1Name: tier1Division, tier2Name: tier2Division } = getRegionsAtPoint([longitude, latitude]);

    const crime = getSelectedCrime();
    const year = getSelectedYear();

    if (tier1Division != null) {
        const crimeDataAreaName = tierNamesToAreaNames(tier1Division, tier2Division);
        const datapoint = getDataPoint(crimeDataAreaName, crime, year, true)

        // has the data point been filled in?
        filled = (datapoint !== getDataPoint(crimeDataAreaName, crime, year, false)) ? "<br>Data filled; region was part of neighbouring region at the time." : ""

        tooltip
            .html(`
<strong>Tier 1 Division:</strong> ${tier1Division}<br>
<strong>Tier 2 Division:</strong> ${tier2Division}<br>
<strong>${prettifyCrimeName(crime)}:</strong> ${datapoint}${filled}
`)
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY + 10 + "px")
            .style("opacity", 1);

    } else {
        tooltip.style("opacity", 0);
    }
}