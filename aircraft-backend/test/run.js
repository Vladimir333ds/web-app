"use strict";

// Load both suites in one process so restricted Windows environments do not
// need the Node test runner to spawn a worker process for each file.
require("./aircraftProvider.test");
require("../../js/aircraft-api.test");
