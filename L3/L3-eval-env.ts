// L3-eval.ts
// Evaluator with Environments model

import { map } from "ramda";
import {
    isBoolExp, isCExp, isLitExp, isNumExp, isPrimOp, isStrExp, isVarRef,
    isAppExp, isDefineExp, isIfExp, isLetExp, isProcExp,
    Binding, VarDecl, CExp, Exp, IfExp, LetExp, ProcExp, Program,
    parseL3Exp, DefineExp,
    ClassExp,
    isClassExp
} from "./L3-ast";
import { applyEnv, makeEmptyEnv, makeExtEnv, Env } from "./L3-env-env";
import { isClosure, makeClosureEnv, Closure, Value, makeClass, ClassValue, isClass, isObject, ObjectValue, makeObject, isSymbolSExp } from "./L3-value";
import { applyPrimitive } from "./evalPrimitive";
import { allT, first, rest, isEmpty, isNonEmptyList } from "../shared/list";
import { Result, makeOk, makeFailure, bind, mapResult } from "../shared/result";
import { parse as p } from "../shared/parser";
import { format } from "../shared/format";

// ========================================================
// Eval functions
//need to eval an exp -> class exp ->L3applicativeEval
// if we build one: above & app -> l3applyprocedure? -> class is compound -> applyclass (with env- args)
// if we call a method: above & app -> l3applyprocedure -> applyObj -> applymethod?  with env of the class
// confused...

//add supprt in class + object? inside a class theres and object
const applicativeEval = (exp: CExp, env: Env): Result<Value> =>
    isNumExp(exp) ? makeOk(exp.val) :
        isBoolExp(exp) ? makeOk(exp.val) :
            isStrExp(exp) ? makeOk(exp.val) :
                isPrimOp(exp) ? makeOk(exp) :
                    isVarRef(exp) ? applyEnv(env, exp.var) :
                        isLitExp(exp) ? makeOk(exp.val) :
                            isIfExp(exp) ? evalIf(exp, env) :
                                isProcExp(exp) ? evalProc(exp, env) :
                                    isLetExp(exp) ? evalLet(exp, env) :
                                        isClassExp(exp) ? evalClass(exp, env) :    // 2b
                                            isAppExp(exp) ? bind(applicativeEval(exp.rator, env),
                                                (proc: Value) =>
                                                    bind(mapResult((rand: CExp) =>
                                                        applicativeEval(rand, env), exp.rands),
                                                        (args: Value[]) =>
                                                            applyProcedure(proc, args))) : //2b
                                                makeFailure('"let" not supported (yet)');

export const isTrueValue = (x: Value): boolean =>
    !(x === false);

const evalIf = (exp: IfExp, env: Env): Result<Value> =>
    bind(applicativeEval(exp.test, env), (test: Value) =>
        isTrueValue(test) ? applicativeEval(exp.then, env) :
            applicativeEval(exp.alt, env));

const evalProc = (exp: ProcExp, env: Env): Result<Closure> =>
    makeOk(makeClosureEnv(exp.args, exp.body, env));

const evalClass = (exp: ClassExp, env: Env): Result<ClassValue> =>  // 2b
    makeOk(makeClass(exp.fields, exp.methods, env));

// KEY: This procedure does NOT have an env parameter.
//      Instead we use the env of the closure.
// add support for class
const applyProcedure = (proc: Value, args: Value[]): Result<Value> =>
    isPrimOp(proc) ? applyPrimitive(proc, args) :
        isClosure(proc) ? applyClosure(proc, args) :
            isClass(proc) ? applyClass(proc, args) :
                isObject(proc) ? applyMethod(proc, args) :
                    makeFailure(`Bad procedure ${format(proc)}`);


const applyClass = (cls: ClassValue, args: Value[]): Result<ObjectValue> => { //2b
    if (args.length !== cls.fields.length) {
        return makeFailure("number of arguments doesn't match constructor");
    }
    return makeOk(makeObject(cls, args));
}
const applyMethod = (obj: ObjectValue, args: Value[]): Result<Value> => {
    if (args.length === 0 || !isSymbolSExp(args[0])) {
        return makeFailure("Method name must be a symbol");
    }
    
    const methodName = args[0].val;
    const methodBinding = obj.class.methods.find(b => b.var.var === methodName);
    if (!methodBinding) {
        return makeFailure(`Unrecognized method: ${methodName}`);
    }

    const methodBody = methodBinding.val;
    if (!isProcExp(methodBody)) {
        return makeFailure(`Method ${methodName} is not a procedure expression`);
    }

    // get the field names and method parameter names
    const fieldVars: string[] = map((v: VarDecl) => v.var, obj.class.fields); //["a,"b"]
    const methodVars: string[] = map((v: VarDecl) => v.var, methodBody.args); //["k"]

    // get the field values and method argument values
    const fieldValues: Value[] = obj.fields;  //[3, 4]
    const methodValues: Value[] = args.slice(1); // Strip away the method name symbol  [2]

   
    // if (methodValues.length !== methodVars.length) {
    //     return makeFailure(`Wrong number of arguments to method ${methodName}. Expected ${methodVars.length}, got ${methodValues.length}`);
    // }


    // extend the object's definition environment with its instance field values
    const fieldsEnv = makeExtEnv(fieldVars, fieldValues, obj.env); 
    
    //extend the fields environment with the local method parameters
    const methodEnv = makeExtEnv(methodVars, methodValues, fieldsEnv);
    
    return evalSequence(methodBody.body, methodEnv);
};

const applyClosure = (proc: Closure, args: Value[]): Result<Value> => {
    const vars = map((v: VarDecl) => v.var, proc.params);
    return evalSequence(proc.body, makeExtEnv(vars, args, proc.env));
}

// Evaluate a sequence of expressions (in a program)
export const evalSequence = (seq: Exp[], env: Env): Result<Value> =>
    isNonEmptyList<Exp>(seq) ? evalCExps(first(seq), rest(seq), env) :
        makeFailure("Empty sequence");

const evalCExps = (first: Exp, rest: Exp[], env: Env): Result<Value> =>
    isDefineExp(first) ? evalDefineExps(first, rest, env) :
        //if there is only one expression (base case) eval it and return the value 
        isCExp(first) && isEmpty(rest) ? applicativeEval(first, env) :
            // if there are more than one, eval the first and then recursively eval the rest of the sequence in the same env
            isCExp(first) ? bind(applicativeEval(first, env), _ => evalSequence(rest, env)) :
                first;

// Eval a sequence of expressions when the first exp is a Define.
// Compute the rhs of the define, extend the env with the new binding
// then compute the rest of the exps in the new env.
const evalDefineExps = (def: DefineExp, exps: Exp[], env: Env): Result<Value> =>
    bind(applicativeEval(def.val, env), (rhs: Value) =>
        evalSequence(exps, makeExtEnv([def.var.var], [rhs], env)));


// Main program
export const evalL3program = (program: Program): Result<Value> =>
    evalSequence(program.exps, makeEmptyEnv());

export const evalParse = (s: string): Result<Value> =>
    bind(p(s), (x) =>
        bind(parseL3Exp(x), (exp: Exp) =>
            evalSequence([exp], makeEmptyEnv())));

// LET: Direct evaluation rule without syntax expansion
// compute the values, extend the env, eval the body.
const evalLet = (exp: LetExp, env: Env): Result<Value> => {
    const vals = mapResult((v: CExp) =>
        applicativeEval(v, env), map((b: Binding) => b.val, exp.bindings));
    const vars = map((b: Binding) => b.var.var, exp.bindings);
    return bind(vals, (vals: Value[]) =>
        evalSequence(exp.body, makeExtEnv(vars, vals, env)));
}
