import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-professionals-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './professionals-tab.html',
  styleUrls: ['./professionals-tab.css']
})
export class ProfessionalsTabComponent {
  @Input() professionals: any[] = [];
  @Output() bookProfessional = new EventEmitter<any>();
}
