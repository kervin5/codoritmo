/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>

int main() {
	int c = 0;
	scanf("%d", &c);
	switch (c) {
	case 3:
	case 5:
	case 9:
		printf("3, 5 o 9\n");
		break;
	case 1:
		printf("1\n");
		break;
	case 7:
		printf("7\n");
		break;
	default:
		printf("ni 1, ni 3, ni 5, ni 7, ni 9\n");
	}
	return 0;
}
