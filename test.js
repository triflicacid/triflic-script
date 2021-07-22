/** FILE FOR TEST SCRIPTS */

const Complex = require('./src/maths/Complex.js');
Complex.imagLetter = 'j';

let z = new Complex(2, -5);

let w = new Complex(2);
let wp1 = new Complex(4.34355, -0.1);
let r = new Complex(0, -2);
const TWOITERTOL = 2.2204460492503131e-16;

// r/wp1*(2.0*wp1*(wp1+2.0/3.0*r)-r)/(2.0*wp1*(wp1+2.0/3.0*r)-2.0*r);
// r/wp1*(2.0*wp1*(wp1+2.0/3.0*r)-r)/(2.0*wp1*(wp1+2.0/3.0*r)-2.0*r);
//

let ans = Complex.abs(lhs) >= rhs;

console.log(ans.toString());