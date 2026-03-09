fn main() {
    // flotantes
    let _x = 2.0; // f64

    let _y: f32 = 3.0; // f32

    // operaciones
    let sum = 5 + 10;
    println!("Sum: {}", sum);

    // subtraction
    let difference = 95.5 - 4.3;
    println!("Difference: {}", difference);

    // multiplication
    let product = 4 * 30;
    println!("Product: {}", product);

    // division
    let quotient = 56.7 / 32.2;
    println!("Quotient: {}", quotient);
    let truncated = -5 / 3; // Results in -1
    println!("Truncated: {}", truncated);

    // remainder
    let remainder = 43 % 5;
    println!("Remainder: {}", remainder);

    // booleanos
    let _t = true;
    let _f: bool = false; // con tipo explícito

    // caracteres
    let c = 'z';
    let z: char = 'Z'; // con tipo explícito
    let heart_eyed_cat = '😻';
    println!("Character: {}", c);
    println!("Character: {}", z);
    println!("Character: {}", heart_eyed_cat);

    // tuplas
    let tup = (500, 6.4, 1);

    let (_x, y, _z) = tup;

    println!("The value of y is: {y}");

    let five_hundred = tup.0;

    let six_point_four = tup.1;

    let one = tup.2;
    println!("The value of five_hundred is: {five_hundred}");
    println!("The value of six_point_four is: {six_point_four}");
    println!("The value of one is: {one}");

    // arreglos
    let a: [i32; 5] = [1, 2, 3, 4, 5];
    println!("Array: {:?}", a);
    let first = a[0];
    let second = a[1];
    println!("First element: {}", first);
    println!("Second element: {}", second);

    let months: [&str; 12] = ["January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"];
    println!("Months: {:?}", months);

    let a = [3; 5];
    println!("Array: {:?}", a);


}
