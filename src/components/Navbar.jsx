import React, { useState } from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Bell, PersonCircle, Cart, List } from 'react-bootstrap-icons';

const CustomNavbar = ({ onToggleSidebar }) => {
  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="shadow-sm fixed-top">
      <Container fluid>
        <Button variant="dark" onClick={onToggleSidebar} className="me-2">
          <List size={20} />
        </Button>
        <Navbar.Brand href="#" className="ms-2">
          Cámara de Industriales
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="navbarSupportedContent" />
        <Navbar.Collapse id="navbarSupportedContent">
          <Nav className="me-auto mb-2 mb-lg-0">
            <Nav.Link href="#">Dashboard</Nav.Link>
            <Nav.Link href="#">Team</Nav.Link>
            <Nav.Link href="#">Projects</Nav.Link>
          </Nav>
          <Nav className="d-flex align-items-center">
            <Nav.Link href="#" className="me-3">
              <Cart size={20} />
            </Nav.Link>
            <Nav.Link href="#" className="me-3">
              <Bell size={20} />
              <span className="badge bg-danger rounded-pill">1</span>
            </Nav.Link>
            <Nav.Link href="#">
              <PersonCircle size={20} />
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default CustomNavbar;