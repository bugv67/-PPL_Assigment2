import {  evalL3program } from '../L3/L3-eval-env';
import { SExpValue, Value, valueToString } from "../L3/L3-value";
import { Result, bind, isOk, makeOk, makeFailure } from "../shared/result";
import { parseL3} from "../L3/L3-ast";


const evalP = (x: string): Result<Value> =>
    bind(parseL3(x), evalL3program);

const evalP2String = (x: string): string => {
    const res : Result<SExpValue> = bind(parseL3(x), evalL3program);
    return isOk(res) ? valueToString(res.value) : res.message;
}

describe('Q2B Tests for environment model', () => {
    
    it("Test class definition", () => {
        expect(evalP2String(`
        (L3
         (define pair 
            (class (a b) 
               ((first (lambda () a)) 
                (second (lambda () b))
                (sum (lambda () (+ a b)))
                (f (lambda (k) (/ (* k a) (* k b))))
               )
             )
         )
         pair
        )`)).toStrictEqual("Class");
    });

    it("Test object definition", () => {
        expect(evalP2String(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a)) 
                   (second (lambda () b))
                   (sum (lambda () (+ a b)))
                   (f (lambda (k) (/ (* k a) (* k b))))
                  )
                )
            )
            (define p34 (pair 3 4))
            p34
        )
        `)).toStrictEqual("Object");
    });    
    
    it("Test object methods application", () => {

        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a)) 
                   (second (lambda () b))
                   (sum (lambda () (+ a b)))
                   (f (lambda (k) (/ (* k a) (* k b))))
                  )
                )
            )
            (define p34 (pair 3 4))
            (p34 'first)
        )
        `)).toStrictEqual(makeOk(3));

        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a)) 
                   (second (lambda () b))
                   (sum (lambda () (+ a b)))
                   (f (lambda (k) (/ (* k a) (* k b))))
                  )
                )
            )
            (define p34 (pair 3 4))
            (p34 'second)
        )
        `)).toStrictEqual(makeOk(4));

        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a)) 
                   (second (lambda () b))
                   (sum (lambda () (+ a b)))
                   (f (lambda (k) (/ (* k a) (* k b))))
                  )
                )
            )
            (define p34 (pair 3 4))
            (p34 'sum)
        )
        `)).toStrictEqual(makeOk(7));

    });    

    it("Test object methods application with parameters", () => {

    expect(evalP(`
    (L3
        (define pair 
           (class (a b) 
              ((first (lambda () a)) 
               (second (lambda () b))
               (sum (lambda () (+ a b)))
               (f (lambda (k) (/ (* k a) (* k b))))
              )
            )
        )
        (define p34 (pair 3 4))
        (p34 'f 2)
    )
    `)).toStrictEqual(makeOk(0.75));
});


it("Test unknown methods application for environment model", () => {

    expect(evalP(`
    (L3
        (define pair 
          (class (a b) 
           ((first (lambda () a)) 
            (second (lambda () b))
            (sum (lambda () (+ a b)))
            (f (lambda (k) (/ (* k a) (* k b))))
           )
          )
        )
        (define p34 (pair 3 4))
        (p34 'power)
    )
`)).toStrictEqual(makeFailure("Unrecognized method: power"));

});

it("Test unknown field in methods application", () => {

    expect(evalP(`
    (L3
      (define pair 
        (class (a b) 
           ((first (lambda () a)) 
            (second (lambda () b))
            (sum (lambda () (+ a c)))
            (f (lambda (k) (/ (* k a) (* k b))))
           )
        )
      )
      (define p34 (pair 3 4))
      (p34 'sum)
    )
`)).toStrictEqual(makeFailure("var not found: c"));

});

it("Test nested object methods application", () => {

    expect(evalP(`
    (L3
        (
         (lambda (obj) (obj 'first))
         (
           (class (a b) 
              ((first (lambda () a)) 
               (second (lambda () b))
               (sum (lambda () (+ a b)))
               (f (lambda (k) (/ (* k a) (* k b))))
              )
            )
            3 4
         )
       )
    )
    `)).toStrictEqual(makeOk(3));


 
});

it("Test field shadowing inside methods", () => {
        // Checks that method parameters can shadow class fields correctly
        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a)) 
                   (shadow-test (lambda (a) (+ a b)))
                  )
                )
            )
            (define p34 (pair 3 4))
            (p34 'shadow-test 10)
        )
        `)).toStrictEqual(makeOk(14)); // 10 (param) + 4 (field), NOT 3 + 4
    });

    it("Test mutation of global variables inside methods", () => {
        // Ensures that methods retain a reference to the global environment
        // and can access/interact with global definitions if needed
        expect(evalP(`
        (L3
            (define factor 2)
            (define multiplier 
               (class (a) 
                  ((scaled (lambda () (* a factor)))
                  )
                )
            )
            (define m5 (multiplier 5))
            (m5 'scaled)
        )
        `)).toStrictEqual(makeOk(10));
    });

    it("Test class instantiator acting as a regular closure", () => {
        // Verifies that a Class value can be passed around as a first-class citizen
        // and invoked dynamically inside another function
        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a))
                   (second (lambda () b))
                  )
                )
            )
            (define make-instance (lambda (cls x y) (cls x y)))
            (define p56 (make-instance pair 5 6))
            (p56 'second)
        )
        `)).toStrictEqual(makeOk(6));
    });

    it("Test multiple independent instances", () => {
        // Crucial for the environment model: ensures that each instance creates 
        // its own distinct environment frame and fields don't bleed into each other
        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a))
                  )
                )
            )
            (define p1 (pair 10 20))
            (define p2 (pair 100 200))
            (+ (p1 'first) (p2 'first))
        )
        `)).toStrictEqual(makeOk(110));
    });

    it("Test passing objects as arguments to methods of other objects", () => {
        // Verifies complex inter-object interaction and correct environment resolution
        expect(evalP(`
        (L3
            (define point 
               (class (x y) 
                  ((getX (lambda () x))
                   (getY (lambda () y))
                  )
                )
            )
            (define distance-calculator
               (class () 
                  ((manhattan-dist (lambda (p1 p2) 
                     (+ (- (p2 'getX) (p1 'getX)) 
                        (- (p2 'getY) (p1 'getY)))
                   )))
                )
            )
            (define calc (distance-calculator))
            (define pt1 (point 1 2))
            (define pt2 (point 4 6))
            (calc 'manhattan-dist pt1 pt2)
        )
        `)).toStrictEqual(makeOk(7)); // (4-1) + (6-2) = 3 + 4 = 7
    });

    it("Test empty class and empty method invocation", () => {
        // Edge case: A class with no fields, and a method with no body tracking
        expect(evalP(`
        (L3
            (define empty-class 
               (class () 
                  ((greet (lambda () 42))
                  )
                )
            )
            (define obj (empty-class))
            (obj 'greet)
        )
        `)).toStrictEqual(makeOk(42));
    });

    it("Test passing wrong number of arguments to a method", () => {
        // Tests the robustness of the environment model when a found method 
        // receives a mismatched number of arguments
        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a))
                  )
                )
            )
            (define p34 (pair 3 4))
            (p34 'first 99) 
        )
        `)).toStrictEqual(makeFailure("Wrong number of arguments to method first. Expected 0, got 1")); 
        // Note: adjust the error string above if your L3 implementation uses a different message format
    });


});
