// Grade calculator — a clean if/else-if chain.
// Great first example to see how decisions branch in the flowchart.

function gradeFor(score) {
  if (score >= 90) {
    return "A";
  } else if (score >= 80) {
    return "B";
  } else if (score >= 70) {
    return "C";
  } else {
    return "F";
  }
}

let result = gradeFor(85);
console.log("Your grade is " + result);
