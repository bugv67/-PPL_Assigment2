// L3-eval.ts
import { concat, is, map } from "ramda";
import { ClassExp, isCExp, isClassExp, isLetExp } from "./L3-ast";
import { BoolExp, CExp, Exp, IfExp, LitExp, NumExp,
         PrimOp, ProcExp, Program, StrExp, VarDecl } from "./L3-ast";
import { isAppExp, isBoolExp, isDefineExp, isIfExp, isLitExp, isNumExp,
             isPrimOp, isProcExp, isStrExp, isVarRef } from "./L3-ast";
import { makeBoolExp, makeLitExp, makeNumExp, makeProcExp, makeStrExp } from "./L3-ast";
import { parseL3Exp } from "./L3-ast";
import { applyEnv, makeEmptyEnv, makeEnv, Env } from "./L3-env-sub";
import { isClosure, makeClosure, Closure, Value, makeClass, ClassValue, isClass, makeObject, ObjectValue, isObject, isSymbolSExp } from "./L3-value";
import { first, rest, isEmpty, List, isNonEmptyList, cons } from '../shared/list';
import { isBoolean, isNumber, isString } from "../shared/type-predicates";
import { Result, makeOk, makeFailure, bind, mapResult, mapv } from "../shared/result";
import { renameExps, substitute } from "./substitute";
import { applyPrimitive } from "./evalPrimitive";
import { parse as p } from "../shared/parser";
import { Sexp } from "s-expression";
import { format } from "../shared/format";

// ========================================================
// Eval functions
//need to eval an exp -> class exp ->L3applicativeEval
// if we build one: above & app -> l3applyprocedure? -> class is compound -> applyclass (with env- args)
// if we call a method: above & app -> l3applyprocedure -> applyObj -> applymethod?  with env of the class
// confused...

// add support in class + object? inside a class theres and object
const L3applicativeEval = (exp: CExp, env: Env): Result<Value> =>
    isNumExp(exp) ? makeOk(exp.val) : 
    isBoolExp(exp) ? makeOk(exp.val) :
    isStrExp(exp) ? makeOk(exp.val) :
    isPrimOp(exp) ? makeOk(exp) :
    isVarRef(exp) ? applyEnv(env, exp.var) :
    isLitExp(exp) ? makeOk(exp.val) :
    isIfExp(exp) ? evalIf(exp, env) :
    isProcExp(exp) ? evalProc(exp, env) :
    isAppExp(exp) ? bind(L3applicativeEval(exp.rator, env), (rator: Value) =>
                        bind(mapResult(param => 
                            L3applicativeEval(param, env), 
                              exp.rands), 
                            (rands: Value[]) =>
                                L3applyProcedure(rator, rands, env))) :
    isLetExp(exp) ? makeFailure('"let" not supported (yet)') :
    isClassExp(exp) ? evalClass(exp, env) :    //2b
    makeFailure('Never');

export const isTrueValue = (x: Value): boolean =>
    ! (x === false);

const evalIf = (exp: IfExp, env: Env): Result<Value> =>
    bind(L3applicativeEval(exp.test, env), (test: Value) => 
        isTrueValue(test) ? L3applicativeEval(exp.then, env) : 
        L3applicativeEval(exp.alt, env));

const evalProc = (exp: ProcExp, env: Env): Result<Closure> =>
    makeOk(makeClosure(exp.args, exp.body));

const evalClass = (exp : ClassExp, env: Env): Result<ClassValue> => 
    makeOk(makeClass(exp.fields, exp.methods , makeEmptyEnv()));
  /* const evalClass = (exp: ClassExp, exp: Env): Result<ClassValue> =>  // 2b
    makeOk(makeClass(exp.fields, exp.methods, makeEmptyEnv()));
   */
const L3applyProcedure = (proc: Value, args: Value[], env: Env): Result<Value> =>
    isPrimOp(proc) ? applyPrimitive(proc, args) :
    isClosure(proc) ? applyClosure(proc, args, env) :
    isClass(proc) ? applyClass(proc, args, env) :
    isObject(proc) ? applyMethod(proc, args, env) :
    makeFailure(`Bad procedure ${format(proc)}`);

// Applications are computed by substituting computed
// values into the body of the closure.
// To make the types fit - computed values of params must be
// turned back in Literal Expressions that eval to the computed value.
const valueToLitExp = (v: Value): NumExp | BoolExp | StrExp | LitExp | PrimOp | ProcExp =>
    isNumber(v) ? makeNumExp(v) :
    isBoolean(v) ? makeBoolExp(v) :
    isString(v) ? makeStrExp(v) :
    isPrimOp(v) ? v :
    isClosure(v) ? makeProcExp(v.params, v.body) :
    makeLitExp(v);

const applyClosure = (proc: Closure, args: Value[], env: Env): Result<Value> => {
    const vars = map((v: VarDecl) => v.var, proc.params);
    const body = renameExps(proc.body);
    const litArgs : CExp[] = map(valueToLitExp, args);
    return evalSequence(substitute(body, vars, litArgs), env);
    //return evalSequence(substitute(proc.body, vars, litArgs), env);
}

const applyClass = (cls: ClassValue, args: Value[], env: Env): Result<ObjectValue> => {
    // making an object instance
    if (args.length !== cls.fields.length) {
        return makeFailure("number of arguments doesnt match constructor");
    }
    return makeOk(makeObject(cls, args));
}

const applyMethod = (obj: ObjectValue, args: Value[], env: Env): Result<Value> => {

    if (args.length === 0 || args.length > 2 || !isSymbolSExp(args[0])) {
        return makeFailure("must have a method and name must be a symbol");
    }
    
    const methodName = args[0].val;
    
    const methodBinding = obj.class.methods.find(b => b.var.var === methodName);
    if (!methodBinding) {
        return makeFailure(`Unrecognized method: ${methodName}`);
    }
    
    return bind(L3applicativeEval(methodBinding.val, env), (proc: Value) => {
        if (!isClosure(proc)) {
            return makeFailure(`Method ${methodName} is not a procedure`);
        }
        
        // [a,b]
        const fieldVars = map((v: VarDecl) => v.var, obj.class.fields);
        // the actual field values of the instance [5,7]
        const fieldLitArgs = map(valueToLitExp, obj.fields);
        
        //the name of the method parameters [k]
        const methodVars = map((v: VarDecl) => v.var, proc.params);
        // the values of the method parameters in the method call [2]
        const methodLitArgs = map(valueToLitExp, args.slice(1));
        
        // if (methodLitArgs.length !== methodVars.length) {
        //     return makeFailure(`Wrong number of arguments to method ${methodName}. Expected ${methodVars.length}, got ${methodLitArgs.length}`);
        // } checked in applyClass??
        
        //one big array
        // [a,b,k] 
        const allVars = concat(fieldVars, methodVars);
        // [5,7,2]
        const allLitArgs = concat(fieldLitArgs, methodLitArgs);
        
        const body = renameExps(proc.body);
        return evalSequence(substitute(body, allVars, allLitArgs), env);
    });
}

// Evaluate a sequence of expressions (in a program)
export const evalSequence = (seq: List<Exp>, env: Env): Result<Value> =>
    isNonEmptyList<Exp>(seq) ? 
        isDefineExp(first(seq)) ? evalDefineExps(first(seq), rest(seq), env) :
        evalCExps(first(seq), rest(seq), env) :
    makeFailure("Empty sequence");

const evalCExps = (first: Exp, rest: Exp[], env: Env): Result<Value> =>
    isCExp(first) && isEmpty(rest) ? L3applicativeEval(first, env) :
    isCExp(first) ? bind(L3applicativeEval(first, env), _ => 
                            evalSequence(rest, env)) :
    makeFailure("Never");

// Eval a sequence of expressions when the first exp is a Define.
// Compute the rhs of the define, extend the env with the new binding
// then compute the rest of the exps in the new env.
const evalDefineExps = (def: Exp, exps: Exp[], env: Env): Result<Value> =>
    isDefineExp(def) ? bind(L3applicativeEval(def.val, env), 
                            (rhs: Value) => 
                                evalSequence(exps, 
                                    makeEnv(def.var.var, rhs, env))) :
    makeFailure(`Unexpected in evalDefine: ${format(def)}`);

// Main program
export const evalL3program = (program: Program): Result<Value> =>
    evalSequence(program.exps, makeEmptyEnv());

export const evalParse = (s: string): Result<Value> =>
    bind(p(s), (sexp: Sexp) => 
        bind(parseL3Exp(sexp), (exp: Exp) =>
            evalSequence([exp], makeEmptyEnv())));
