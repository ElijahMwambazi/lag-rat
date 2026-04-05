use lag_rat_backend::monitors::devices::{
    parse_inventory_line, parse_linux_proc_arp, parse_unix_arp, parse_windows_arp,
};

#[test]
fn parses_linux_proc_arp_line() {
    let line = "192.168.1.10 0x1 0x2 aa:bb:cc:dd:ee:ff * wlan0";
    let parsed = parse_linux_proc_arp(line).unwrap();
    assert_eq!(parsed.0, "192.168.1.10");
    assert_eq!(parsed.1.as_deref(), Some("aa:bb:cc:dd:ee:ff"));
    assert_eq!(parsed.2.as_deref(), Some("wlan0"));
}

#[test]
fn parses_unix_arp_line() {
    let line = "? (192.168.1.11) at aa:bb:cc:dd:ee:11 on en0 ifscope [ethernet]";
    let parsed = parse_unix_arp(line).unwrap();
    assert_eq!(parsed.0, "192.168.1.11");
    assert_eq!(parsed.1.as_deref(), Some("aa:bb:cc:dd:ee:11"));
    assert!(parsed.2.is_none());
}

#[test]
fn parses_windows_arp_line() {
    let line = "192.168.1.12          aa-bb-cc-dd-ee-12     dynamic";
    let parsed = parse_windows_arp(line).unwrap();
    assert_eq!(parsed.0, "192.168.1.12");
    assert_eq!(parsed.1.as_deref(), Some("aa:bb:cc:dd:ee:12"));
}

#[test]
fn parse_inventory_line_ignores_garbage() {
    assert!(parse_inventory_line("Interface: 192.168.1.1 --- 0x6").is_none());
}
