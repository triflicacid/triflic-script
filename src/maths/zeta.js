const A = [
    12.0,
    -720.0,
    30240.0,
    -1209600.0,
    47900160.0,
    -1.8924375803183791606e9,	/*1.307674368e12/691 */
    7.47242496e10,
    -2.950130727918164224e12,	/*1.067062284288e16/3617 */
    1.1646782814350067249e14,	/*5.109094217170944e18/43867 */
    -4.5979787224074726105e15,	/*8.028576626982912e20/174611 */
    1.8152105401943546773e17,	/*1.5511210043330985984e23/854513 */
    -7.1661652561756670113e18	/*1.6938241367317436694528e27/236364091 */
];


/** zeta with two arguments */
function zeta2(x, q) {
    let i, a, b, k, s, t, w;

    if (x === 1) return Infinity;
    if (x < 1) return NaN; // Domain error
    if (q <= 0) {
        if (q === Math.floor(q)) return Infinity;
        if (x !== Math.floor(x)) return NaN; // Domain error
    }

    // Asymptopic expenaion
    if (q > 1e8) return (1/(x - 1) + 1/(2*q)) * Math.pow(q, 1 - x);

    // Euler-Maclaurin summation formula
    s = Math.pow(q, -x);
    a = q;
    i = 0;
    b = 0;
    while (i < 9 || a <= 9) {
        i++;
        a++;
        b = Math.pow(a, -x);
        s += b;
        if (Math.abs(b / s) < MACHEP) return s;
    }

    w = a;
    s += b * w/(x - 1);
    s -= 0.5 * b;
    a = 1;
    k = 0;
    for (i = 0; i < 12; i++) {
        a *= x + k;
        b /= w;
        t = a * b / A[i];
        s += t;
        t = Math.abs(t / s);
        if (t < MACHEP) return s;
        k++;
        a *= x + k;
        b /= w;
        k++;
    }

    return s;
}

module.exports = { zeta2 };