const { LCF } = require("./functions");

class Fraction {
	/**
		@about parses fraction into object
		@param x -> fraction instance, string ...
			x can be:
				- a number
				- a float
				- a fraction e.g. "x/y"
				- a coefficient fraction e.g. "x y/z"
		@param simplfiy (bool) Simplify fraction?
	*/
	constructor(x, simplify = true) {
		// Already fraction?
		if (x instanceof Fraction) {
			this.numerator = x.numerator;
			this.denominator = x.denominator;
		}
		// Already in fraction form
		else if (x.toString().match(/\//) != null) {
			let arg = x.toString(), coeff = null;
			
			// Check for big number in front
			if (arg.match(/\s/) && !isNaN(Number(arg[0]))) {
				let parts = arg.split(/\s/);
				coeff = parts[0];
				arg = parts[1];
			}
			let parts = arg.split("/");
			
			// Simplify each part
			if (simplify) {
				let num = +parts[0],
					denom = +parts[1],
					divisor = LCF(num, denom);
				this.numerator = num / divisor;
				this.denominator = denom / divisor;
			} else {
				this.numerator = +parts[0];
				this.denominator = +parts[1];
			}
			
			if (coeff != null) {
				for (let i = 0; i < coeff; ++i) {
					this.numerator += this.denominator;
				}
			}
		} else if (Array.isArray(x) && x.length === 2) {
			this.numerator = +x[0];
			this.denominator = +x[1];
		} else {
			let parts = Fractions.ToFraction(x);
			this.numerator = parts[0];
			this.denominator = parts[1];
		}
		
		if (isNaN(this.numerator) || isNaN(this.denominator)) throw new Error(`Fraction: invalid fraction "${x}"`);
		
		// If denominator is negative, swap it to the numerator
		if (this.denominator < 0) {
			this.denominator = Math.abs(this.denominator);
			this.numerator = -this.numerator;
		}
	}

	/**
		@returns fraction in decimal form
	*/
	toNumber() {
		return this.numerator / this.denominator;
	}
	
	/**
		@returns fraction in string form
		@param returnImproper return proper or improper fraction?
	*/
	toString(returnImproper = true) {
		if (this.denominator == 1)
			return this.numerator.toString();
		else if (this.numerator == this.denominator)
			return "1";
		else if (this.numerator < this.denominator || returnImproper)
			return this.numerator + "/" + this.denominator;
		else
			return Math.floor(this.numerator / this.denominator) + " " + (this.numerator % this.denominator) + "/" + this.denominator;
	}

	/**
	 * @about mutates fraction and simplifies it
	 */
	simplify() {
		let common = LCF(this.numerator, this.denominator);
		this.numerator /= common;
		this.denominator /= common;
		return this;
	}
	
	/**
		@returns reciprocal of fraction (mutates)
	*/
	reciprocal() {
		let tmp = this.numerator;
		this.numerator = this.denominator;
		this.denominator = tmp;
		return this;
	}
	
	/**
		@returns negative reciprocal
	*/
	negativeReciprocal() {
		this.reciprocal();
		this.numerator = -Number(this.numerator);
		
		// If both numbers are negative...
		if (this.numerator < 0 && this.denominator < 0) {
			this.numerator = Math.abs(this.numerator);
			this.denominator = Math.abs(this.denominator);
		}
		return this;
	}
	
	/*!
		@returns copy of this fraction
	*/
	copy() {
		return new Fraction(this.numerator + "/" + this.denominator);
	}
	
	/*!
		@about makes fraction negative
		e.g. "1/3" -> "-1/3"
		e.g. "-1/2" -> "1/2"
	*/
	negative() {
		this.numerator = -this.numerator;
		return this;
	}
	
	/**
		@returns is fraction negative?
	*/
	isNegative() {
		return this.numerator < 0;
	}
	
	/**
		@about makes fraction positive
	*/
	abs() {
		this.numerator = Math.abs(this.numerator);
		return this;
	}
	
	/**
		@about is this > that?
	*/
	isGreaterThan(than) {
		let fracts = Fractions.MakeDenominatorsEqual(this, than);
		return fracts[0].numerator > fracts[1].numerator;
	}
	
	/*!
		@about is this = to?
	*/
	isEqualTo(to) {
		let fracts = Fractions.MakeDenominatorsEqual(this, to);
		return fracts[0].numerator == fracts[1].numerator;
	}
	
	/**
		@about raises fraction to power
		@param power -> any POSITIVE INTEGER
	*/
	pow(power) {
		power = power instanceof Fraction ? power.toNumber() : +power;
		return new Fraction(Fractions.ToFraction(this.toNumber() ** power));
	}
	
	/*!
		@about find square root of fraction
	*/
	sqrt() {
		// return new Fraction([Math.sqrt(this.numerator), Math.sqrt(this.denominator)]);
		return new Fraction(Fractions.ToFraction(Math.sqrt(this.toNumber())));
	}
}

/*!
	Functions to do with Fraction class
*/
class Fractions {
	/*!
		@about returns floating point number as fraction (array)
		@param float -> number to convert
		@returns Array(2) [numerator, denominator]
	*/
	static ToFraction(float) {
		float = +float;
		if (isNaN(float)) throw new Error(`ToFraction: non-numerical value provided`);
		// if whole number...
		if (float == parseInt(float)) {
			return [parseInt(float), 1];
		} else {
			let len = float.toString().length - 2,
				denominator = Math.pow(10, len),
				numerator = float * denominator,
				divisor = LCF(numerator, denominator);
				
			numerator /= divisor;
			denominator /= divisor;
			
			return [Math.floor(numerator), Math.floor(denominator)];
		}
	};
	
	/*!
		@about makes fraction denominators equal
		@param a -> Fraction / string
		@param b -> Fraction / string
		@returns Array(2) [Fraction, Fraction]
	*/
	static MakeDenominatorsEqual(a, b) {
		if (!(a instanceof Fraction)) a = new Fraction(a);
		if (!(b instanceof Fraction)) b = new Fraction(b);
		
		// Check if denominators are equal already
		if (a.denominator == b.denominator) return [a, b];
		
		let aNumerator = a.numerator * b.denominator,
			denominator = a.denominator * b.denominator,
			bNumerator = b.numerator * a.denominator;
			
		return [new Fraction(aNumerator+'/'+denominator, false), new Fraction(bNumerator+'/'+denominator, false)];
	};
	
	/*!
		@about Adds two fractions a + b
		@param a -> Fraction / string
		@param b -> Fraction / string
		@returns Fraction
	*/
	static Add(a, b) {
		if (!(a instanceof Fraction)) a = new Fraction(a);
		if (!(b instanceof Fraction)) b = new Fraction(b);
		
		// Check if denominators are equal
		if (a.denominator == b.denominator) {
			return new Fraction((a.numerator + b.numerator)+"/"+a.denominator);
		} else {
			let aNumerator = a.numerator * b.denominator,
				denominator = a.denominator * b.denominator,
				bNumerator = b.numerator * a.denominator;
				
			return new Fraction((aNumerator + bNumerator)+"/"+denominator);
		}
	};
	
	/*!
		@about Subtracts two fractions a - b
		@param a -> Fraction / string
		@param b -> Fraction / string
		@returns Fraction
	*/
	static Subtract(a, b) {
		if (!(a instanceof Fraction)) a = new Fraction(a);
		if (!(b instanceof Fraction)) b = new Fraction(b);
		
		// Check if denominators are equal
		if (a.denominator == b.denominator) {
			return new Fraction((a.numerator - b.numerator)+"/"+a.denominator);
		} else {
			let aNumerator = a.numerator * b.denominator,
				denominator = a.denominator * b.denominator,
				bNumerator = b.numerator * a.denominator;
				
			return new Fraction((aNumerator - bNumerator)+"/"+denominator);
		}
	};
	
	/*!
		@about Multiplies two fractions a * b
		@param a -> Fraction / string
		@param b -> Fraction / string
		@returns Fraction
	*/
	static Multiply(a, b) {
		if (!(a instanceof Fraction)) a = new Fraction(a);
		if (!(b instanceof Fraction)) b = new Fraction(b);
		
		if (a.numerator == 0 || a.denominator == 0) return a;
		if (b.numerator == 0 || b.denominator == 0) return b;
		
		return new Fraction((a.numerator*b.numerator)+"/"+(a.denominator*b.denominator));
	};
	
	/*!
		@about Divides two fractions a / b
		@param a -> Fraction / string
		@param b -> Fraction / string
		@returns Fraction
	*/
	static Divide(a, b) {
		if (!(a instanceof Fraction)) a = new Fraction(a);
		if (!(b instanceof Fraction)) b = new Fraction(b);
		
		// Flip b
		b = b.copy();
		b.reciprocal();
		
		// Multiply
		return new Fraction((a.numerator*b.numerator)+"/"+(a.denominator*b.denominator));
	}
}


module.exports = { Fraction, Fractions };