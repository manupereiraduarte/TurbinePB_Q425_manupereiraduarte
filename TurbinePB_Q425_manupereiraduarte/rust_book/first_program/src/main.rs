fn main() {
    farenheit_to_celsius();

    fibonacci();

    twelve_days_of_christmas();

}
fn farenheit_to_celsius() {
     // convert farenheit to celsius
    println!("Enter the temperature in Farenheit: ");
    let mut farenheit = String::new();
    std::io::stdin().read_line(&mut farenheit).expect("Failed to read line");
    let farenheit: f64 = farenheit.trim().parse().expect("Please enter a number");
    
    let celsius: f64 = (farenheit - 32.0) / 1.8;

    println!("Temperature in Celsius: {celsius}°C")
}

fn fibonacci() {
    println!("Enter the length of the Fibonacci sequence: ");
    let mut length = String::new();
    std::io::stdin().read_line(&mut length).expect("Failed to read line");
    let long: u32 = length.trim().parse().expect("Please enter a number");

    let mut a: u32 = 0;
    let mut b: u32 = 1;
    for _ in 0..long {
        println!(" {a} ");
        let c = a + b;
        a = b;
        b = c;
    }
}

// funcion para imprimir la letra de los 12 dias de navidad
fn twelve_days_of_christmas() {
    let days = [
        "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"
    ];  
    let gifts = [
        "a partridge in a pear tree", "two turtle doves", "three French hens", "four calling birds", "five gold rings", "six geese a-laying", "seven swans a-swimming", "eight maids a-milking", "nine ladies dancing", "ten lords a-leaping", "eleven pipers piping", "twelve drummers drumming"
    ];

    for i in 0..12 {
        println!("On the {} day of Christmas, my true love sent to me:", days[i]);
        for j in (0..=i).rev() {
            if j == 0 && i != 0 {
                print!("and ");
            }
            println!("{}", gifts[j]);
        }
        println!();
    }
}