import getRGBPack from "./colorParsing";
import { Types } from "./opcodeDeps";
import { ValueType } from "parsing/IR";
import { evalMaybeRational } from "parsing/parsenode";

export function glslFloatify(x: number) {
  return Number.isInteger(x)
    ? // BigInt prevents scientific notation
      BigInt(x).toString() + ".0"
    : // scientific notation is ok here. We aren't appending ".0"
      // NaN gives "NaN", defined via uniform
      // Infinity gives "Infinity", defined via uniform
      // -Infinity gives "-Infinity"
      x.toString();
}

export function colorVec4(color: string, opacity: number) {
  let r: string, g: string, b: string;
  if (color[0] === "#" && color.length === 7) {
    r = glslFloatify(parseInt(color.slice(1, 3), 16) / 255);
    g = glslFloatify(parseInt(color.slice(3, 5), 16) / 255);
    b = glslFloatify(parseInt(color.slice(5, 7), 16) / 255);
  } else {
    /**
     * alpha from css color is neglected
     * function doesn't support css units other than % on hsl
     * but Desmos either so it doesn't affect much
     */
    [r, g, b] = getRGBPack(color).map(glslFloatify);
  }
  const a = glslFloatify(opacity);
  return `vec4(${r}, ${g}, ${b}, ${a})`;
}

export function compileObject(x: any): string {
  if (Array.isArray(x)) {
    // x is a point (a,b)
    return `vec2(${compileObject(x[0])}, ${compileObject(x[1])})`;
  }
  switch (typeof x) {
    case "boolean":
      return x ? "true" : "false";
    case "object":
      if (typeof x.n !== "number" || typeof x.d !== "number")
        throw Error("Not a rational");
    // ... fall through to number
    case "number":
      return glslFloatify(evalMaybeRational(x));
    case "string":
      throw Error("Strings not handled");
    default:
      throw Error(`Unexpected value ${x}`);
  }
}

export function getGLType(v: ValueType) {
  switch (v) {
    case Types.Bool:
      return "bool";
    case Types.Number:
      return "float";
    case Types.Point:
      return "vec2";
    case Types.ListOfBool:
      return "bool[]";
    case Types.ListOfNumber:
      return "float[]";
    case Types.ListOfPoint:
      return "vec2[]";
    default:
      throw Error(`Type ${v} is not yet supported`);
  }
}

export function getGLTypeOfLength(v: ValueType, len: number) {
  const t = getGLType(v);
  return t.endsWith("[]") ? t.slice(0, -1) + len.toFixed(0) + "]" : t;
}

export function getGLScalarType(v: ValueType) {
  const type = getGLType(v);
  if (type.endsWith("[]")) return type.slice(0, -2);
  else return type;
}
