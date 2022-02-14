interface SchemaNode {
    ty: "number" | "string" | "boolean" | "enum" | "object" | "tuple" | "array"
    quick?: boolean
    root?: boolean
    locked?: boolean
    strict?: boolean
}

interface SimpleNode<T> extends SchemaNode {
    ty: "number" | "string" | "boolean" | "enum"
    dft?: T
    readonly rec?: 1
}

interface NumberNode extends SimpleNode<number> {
    ty: "number"
	integer?: boolean
    min?: number
    max?: number
}

const number_example: NumberNode = {
	ty: "number",
	integer: false,
	min: -114,
	max: 514,
	dft: 191
}

interface BooleanNode extends SimpleNode<boolean> {
    ty: "boolean"
}

const boolean_example: BooleanNode = {
    ty: "boolean",
	dft: true
}

interface StringNode extends SimpleNode<string> {
    ty: "string"
}

const string_example: StringNode = {
	ty: "string",
	dft: "TM-dat is awesome!"
}

interface EnumNode<vals extends any[]> extends SimpleNode<vals[number]> {
	ty: "enum",
	vals: vals
}

const enum_example: EnumNode<[ "A", "C" ]> = {
	ty: "enum",
	vals: [ "A", "C" ],
	dft: "A"
}

interface FixedComplexNode extends SchemaNode {
    ty: "object" | "tuple"
    readonly rec?: 2
}

interface ObjectNode extends FixedComplexNode {
    ty: "object"
    lvs: {
        [key: string]: SchemaNode
    }
}

const object_example: ObjectNode = {
	ty: "object",
	lvs: {
		hello: {
			ty: "string",
			dft: "world"
		} as StringNode,
		again: {
			ty: "object",
			lvs: {
				world: {
					ty: "string",
					dft: "hello"
				} as StringNode
			}
		} as ObjectNode
	}
}

interface RepeatableNode extends SchemaNode {
	repeat?: number
}

interface TupleNode extends FixedComplexNode {
	ty: "tuple",
	lvs: RepeatableNode[]
}

const tuple_example: TupleNode = {
	ty: "tuple",
	lvs: [
		{ ty: "string", dft: "name" } as StringNode,
		{
			ty: "number", min: 0, max: 100, dft: 60,
			repeat: 6
		} as NumberNode
	]
}

interface FlexibleComplexNode extends SchemaNode {
    ty: "array" // WIP: | "dict"
    readonly rec?: 2
}

interface ArrayNode extends FlexibleComplexNode {
	ty: "array",
	maxIdx?: number,
	itm: SchemaNode
}

const array_example: ArrayNode = {
	ty: "array",
	maxIdx: 3,
	itm: {
		ty: "object",
		lvs: {
			number: number_example,
			string: string_example,
			enum: enum_example
		}
	} as ObjectNode
}
