use lag_rat_backend::monitors::devices::{
    expand_ipv4_cidr, ip_is_in_cidr, parse_avahi_resolve_output, parse_getent_hosts_output,
    parse_inventory_line, parse_linux_ip_neigh, parse_linux_proc_arp, parse_unix_arp,
    parse_windows_arp, should_persist_device_entry,
};

#[test]
fn parses_linux_proc_arp_line() {
    let line = "192.168.1.10 0x1 0x2 aa:bb:cc:dd:ee:ff * wlan0";
    let parsed = parse_linux_proc_arp(line).unwrap();
    assert_eq!(parsed.0, "192.168.1.10");
    assert_eq!(parsed.1.as_deref(), Some("aa:bb:cc:dd:ee:ff"));
    assert!(parsed.2.is_none());
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

#[test]
fn parses_linux_ip_neigh_line() {
    let line = "192.168.1.20 dev wlan0 lladdr aa:bb:cc:dd:ee:20 REACHABLE";
    let parsed = parse_linux_ip_neigh(line).unwrap();
    assert_eq!(parsed.0, "192.168.1.20");
    assert_eq!(parsed.1.as_deref(), Some("aa:bb:cc:dd:ee:20"));
    assert!(parsed.2.is_none());
}

#[test]
fn parse_inventory_line_prefers_ip_neigh_over_proc_arp() {
    let line = "192.168.1.20 dev wlan0 lladdr aa:bb:cc:dd:ee:20 REACHABLE";
    let parsed = parse_inventory_line(line).unwrap();
    assert_eq!(parsed.0, "192.168.1.20");
    assert_eq!(parsed.1.as_deref(), Some("aa:bb:cc:dd:ee:20"));
    assert!(parsed.2.is_none());
}

#[test]
fn expands_24_bit_cidr_without_network_and_broadcast() {
    let ips = expand_ipv4_cidr("192.168.1.0/24");
    assert!(ips.contains(&"192.168.1.1".to_string()));
    assert!(ips.contains(&"192.168.1.254".to_string()));
    assert!(!ips.contains(&"192.168.1.0".to_string()));
    assert!(!ips.contains(&"192.168.1.255".to_string()));
}

#[test]
fn detects_ip_inside_cidr() {
    assert!(ip_is_in_cidr("192.168.1.109", "192.168.1.0/24"));
}

#[test]
fn rejects_ip_outside_cidr() {
    assert!(!ip_is_in_cidr("172.17.0.1", "192.168.1.0/24"));
}

#[test]
fn skips_low_confidence_ip_only_entries() {
    assert!(!should_persist_device_entry(
        "192.168.1.50",
        None,
        None,
        "192.168.1.1",
    ));
}

#[test]
fn keeps_router_even_without_mac_or_hostname() {
    assert!(should_persist_device_entry(
        "192.168.1.1",
        None,
        None,
        "192.168.1.1",
    ));
}

#[test]
fn keeps_entries_with_mac() {
    assert!(should_persist_device_entry(
        "192.168.1.50",
        Some("aa:bb:cc:dd:ee:ff"),
        None,
        "192.168.1.1",
    ));
}

#[test]
fn parses_getent_hosts_output() {
    let text = "192.168.1.50 printer.lan\n";
    let parsed = parse_getent_hosts_output(text);
    assert_eq!(parsed.as_deref(), Some("printer.lan"));
}

#[test]
fn parses_avahi_resolve_output() {
    let text = "192.168.1.51 my-phone.local\n";
    let parsed = parse_avahi_resolve_output(text);
    assert_eq!(parsed.as_deref(), Some("my-phone.local"));
}

#[test]
fn ignores_empty_hostname_lookup_output() {
    assert!(parse_getent_hosts_output("").is_none());
    assert!(parse_avahi_resolve_output("").is_none());
}
