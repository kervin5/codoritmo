/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>

int main() {
	double c;
	c = 0;
	while (c<=10) {
		c = c+1;
		printf("%g\n", c);
	}
	c = 0;
	do {
		c = c+1;
		printf("%g\n", c);
	} while (c!=10);
	c = 0;
	do {
		c = c+1;
		printf("%g\n", c);
	} while (c<10);
	if (c==10) {
		printf("Si\n");
	}
	if (c==10) {
		printf("Si\n");
	} else {
		printf("No\n");
	}
	return 0;
}
