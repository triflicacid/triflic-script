const { errors } = require("../src/errors");
const { types, isNumericType } = require("../src/evaluation/types");
const { Value, ArrayValue, StringValue, NumberValue, BoolValue, UndefinedValue } = require("../src/evaluation/values");
const Vector = require("../src/maths/Vector");
const { RunspaceBuiltinFunction } = require("../src/runspace/Function");

const TYPENAME = 'vector';

class VectorValue extends Value {
    constructor(rs, vec = undefined) {
        if (vec === undefined) vec = Vector.create(2);
        super(rs, vec);
    }

    type() { return TYPENAME; }

    __iter__() { return [...this.value.data]; }

    __len__(newLength = undefined) {
        if (newLength !== undefined) throw new Error(`[${errors.TYPE_ERROR}] Type Error: cannot set len() of type ${this.type()}`);
        return this.value.size();
    }

    /** get() function */
    __get__(i) {
        i = i.toPrimitive('real_int');
        if (i < 0) i = this.value.size() + i; // Advance from end of array
        const val = (isNaN(i) || i < 0 || i >= this.value.size().length) ? new UndefinedValue(this.rs) : new NumberValue(this.rs, this.value.get(i));
        val.onAssign = value => this.__set__(i, value);
        val.getAssignVal = () => val;
        return val;
    }

    /** set() function */
    __set__(i, value) {
        i = typeof i === 'number' ? i : i.toPrimitive('real_int');
        if (i < 0) i = this.value.size() + i;
        if (isNaN(i) || i < 0) return new UndefinedValue(this.rs);
        this.value.set(i, value.toPrimitive('complex'));
        return this;
    }

    /** Function: abs() */
    __abs__() { return this.value.abs(); }

    /** operator: + */
    __add__(v) {
        if (v.type() === TYPENAME) return new VectorValue(this.rs, Vector.add(this.value, v.value));
    }

    /** operator: - */
    __sub__(v) {
        if (v.type() === TYPENAME) return new VectorValue(this.rs, Vector.sub(this.value, v.value));
    }

    /** operator: * */
    __mul__(v) {
        const t = v.type();
        if (isNumericType(t)) return new VectorValue(this.rs, Vector.scalarMult(this.value, v.toPrimitive('complex')));
    }
}

module.exports = rs => {
    Value.typeMap[TYPENAME] = VectorValue;
    types[TYPENAME] = 20;

    ArrayValue.castMap.vector = o => new VectorValue(o.rs, new Vector(...o.toPrimitive('array')));
    VectorValue.castMap = {
        string: o => new StringValue(o.rs, o.value.toString()),
        array: o => new ArrayValue(o.rs, o.__iter__().map(n => new NumberValue(o.rs, n))),
        bool: o => new BoolValue(o.rs, true),
    };

    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'vector', { args: {type:'any', ellipse:1} }, ({ args }) => {
        args = args.toPrimitive('array');
        if (args.length === 1) {
            let size = args[0];
            let nsize = size.toPrimitive('real_int');
            if (nsize < 2 || isNaN(nsize) || !isFinite(nsize)) throw new Error(`[${errors.BAD_ARG}] Argument Error: Invalid vector size ${size}`);
            return new VectorValue(rs, Vector.create(nsize));
        } else {
            if (args.length < 2) throw new Error(`[${errors.BAD_ARG}] Argument Error: Invalid vector size ${args.length}`);
            return new VectorValue(rs, new Vector(args.map(n => n.toPrimitive('complex'))));
        }
    }, 'Creates a vector. If args is one item, create vector of size {args[0]}. Else, create vector with {args} as elements'));
};